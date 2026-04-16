// Vercel serverless proxy — keeps GROQ_API_KEY server-side
// Rate limit: 20 req/min per IP (in-memory; resets on cold start — see README for distributed option)

const rateMap = new Map()
const VALID_ROLES = new Set(['system', 'user', 'assistant'])
const MAX_MESSAGES = 12
const MAX_CONTENT_LEN = 28_000 // characters across all messages combined
const UPSTREAM_TIMEOUT_MS = 25_000

function isRateLimited(ip) {
  const now = Date.now()
  const window = 60_000
  const limit = 20
  const entry = rateMap.get(ip) || { count: 0, start: now }
  if (now - entry.start > window) {
    rateMap.set(ip, { count: 1, start: now })
    return false
  }
  if (entry.count >= limit) return true
  rateMap.set(ip, { count: entry.count + 1, start: entry.start })
  return false
}

export default async function handler(req, res) {
  // ── CORS: lock to configured origin, not wildcard ──────────────────────────
  const origin = req.headers.origin || ''
  const allowed = process.env.ALLOWED_ORIGIN
  if (!allowed || origin === allowed) {
    // If no ALLOWED_ORIGIN is set, reflect the request origin (dev-friendly fallback)
    res.setHeader('Access-Control-Allow-Origin', origin || '*')
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Vary', 'Origin')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return res.status(503).json({
      error: 'This instance has no GROQ_API_KEY configured. Add your own key above.',
    })
  }

  // ── IP: prefer x-real-ip (set by Vercel's edge, not spoofable by clients) ──
  const ip =
    req.headers['x-real-ip'] ||
    req.headers['x-forwarded-for']?.split(',').at(-1)?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'

  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Rate limit reached (20 req/min). Try again shortly.' })
  }

  // ── Input validation ────────────────────────────────────────────────────────
  const { messages } = req.body || {}

  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    return res.status(400).json({ error: 'Invalid messages' })
  }

  for (const m of messages) {
    if (!VALID_ROLES.has(m?.role) || typeof m?.content !== 'string') {
      return res.status(400).json({ error: 'Invalid message format' })
    }
  }

  const totalLen = messages.reduce((n, m) => n + m.content.length, 0)
  if (totalLen > MAX_CONTENT_LEN) {
    return res.status(400).json({ error: 'Request too large' })
  }

  const wantStream = req.body?.stream === true

  // ── Upstream request with timeout ──────────────────────────────────────────
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)

  try {
    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.1,
        max_tokens: 900,
        response_format: { type: 'json_object' },
        stream: wantStream,
      }),
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!upstream.ok) {
      const data = await upstream.json()
      return res.status(upstream.status).json(data)
    }

    if (wantStream) {
      // Forward SSE stream to client
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('X-Accel-Buffering', 'no')
      const reader = upstream.body.getReader()
      const decoder = new TextDecoder()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          res.write(decoder.decode(value, { stream: true }))
        }
      } finally {
        res.end()
      }
      return
    }

    const data = await upstream.json()
    res.json({ content: data.choices[0].message.content })
  } catch (e) {
    clearTimeout(timer)
    console.error('[query] upstream error:', e.message)
    if (e.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timed out' })
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}
