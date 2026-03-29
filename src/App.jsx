// DataDropAI — Ask your data anything.
// Single-file React app · Recharts · PapaParse · D3 · html2canvas · Groq (free)

import React, { useState, useRef, useEffect } from 'react'
import * as Papa from 'papaparse'
import {
  BarChart, Bar,
  LineChart, Line,
  AreaChart, Area,
  ScatterChart, Scatter,
  PieChart, Pie, Cell,
  ComposedChart,
  XAxis, YAxis, ZAxis,
  CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import * as d3 from 'd3'
import html2canvas from 'html2canvas'

// ─── Constants ────────────────────────────────────────────────────────────────

// Colors ordered for maximum perceptual contrast at any n:
// 2 items → index 0+1 are maximally different; 3 → 0+1+2 form a good triad; etc.
const PALETTES = {
  datadropai: ['#6366f1','#f59e0b','#10b981','#ef4444','#06b6d4','#ec4899','#8b5cf6','#f97316','#84cc16','#14b8a6'],
  warm:       ['#f59e0b','#ef4444','#ec4899','#f97316','#fbbf24','#f43f5e','#fb923c','#e11d48','#dc2626','#c2410c'],
  cool:       ['#06b6d4','#8b5cf6','#3b82f6','#22d3ee','#6366f1','#0ea5e9','#a78bfa','#60a5fa','#818cf8','#93c5fd'],
  mono:       ['#a3a3a3','#404040','#d4d4d4','#737373','#e5e5e5','#525252','#b3b3b3','#303030','#888888','#5c5c5c'],
  colorblind: ['#0077bb','#ee7733','#ee3377','#009988','#bbbbbb','#33bbee','#cc3311','#0099cc','#aacc00','#ddaa33'],
}

const PALETTE_NAMES = {
  datadropai: 'DataDropAI', warm: 'Warm', cool: 'Cool', mono: 'Mono', colorblind: 'Colorblind',
}

// Uses CSS vars — works in both dark and light themes
const TT = {
  backgroundColor: 'var(--sf)',
  border: '1px solid var(--ln2)',
  borderRadius: '8px',
  color: 'var(--t1)',
  fontSize: '12px',
  boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
}

const CHIPS = [
  'What are the totals by category?',
  'How does this change over time?',
  'Which group has the highest average?',
  'What does the distribution look like?',
  'What are the top 10?',
  'Are there any outliers?',
]

const CHART_LABEL = {
  bar: 'Bar', line: 'Line', area: 'Area', scatter: 'Scatter',
  bubble: 'Bubble', pie: 'Pie', donut: 'Donut', heatmap: 'Heatmap', composed: 'Composed',
}

// Max data points rendered per chart type — keeps Recharts from crashing on huge datasets
const CHART_MAX_PTS = {
  bar: 200, line: 2000, area: 2000, scatter: 8000,
  bubble: 4000, pie: 60, donut: 60, heatmap: 3000, composed: 2000,
}

function sampleForChart(data, chartType) {
  const max = CHART_MAX_PTS[chartType] ?? 1000
  if (data.length <= max) return { data, sampled: false, total: data.length }
  const step = data.length / max
  return {
    data: Array.from({ length: max }, (_, i) => data[Math.floor(i * step)]),
    sampled: true,
    total: data.length,
  }
}

// ─── Sample Datasets ──────────────────────────────────────────────────────────

const SAMPLES = [
  {
    id: 'coffee', name: 'Coffee Sales', emoji: '☕',
    description: '10 countries · sales & growth',
    rows: [
      { country: 'United States', sales: 8200, growth: 12, category: 'Espresso' },
      { country: 'Brazil',        sales: 6100, growth: 8,  category: 'Filter'   },
      { country: 'Germany',       sales: 4800, growth: 15, category: 'Espresso' },
      { country: 'Japan',         sales: 4200, growth: 22, category: 'Cold Brew'},
      { country: 'France',        sales: 3900, growth: 5,  category: 'Filter'   },
      { country: 'Italy',         sales: 3600, growth: 3,  category: 'Espresso' },
      { country: 'Canada',        sales: 3100, growth: 18, category: 'Cold Brew'},
      { country: 'Australia',     sales: 2800, growth: 25, category: 'Filter'   },
      { country: 'UK',            sales: 2600, growth: 9,  category: 'Filter'   },
      { country: 'South Korea',   sales: 2200, growth: 31, category: 'Cold Brew'},
    ],
  },
  {
    id: 'stocks', name: 'Tech Stocks 2024', emoji: '📈',
    description: '12 months · AAPL, MSFT, GOOGL',
    rows: [
      { month: 'Jan', AAPL: 185, MSFT: 375, GOOGL: 140 },
      { month: 'Feb', AAPL: 182, MSFT: 405, GOOGL: 155 },
      { month: 'Mar', AAPL: 171, MSFT: 420, GOOGL: 160 },
      { month: 'Apr', AAPL: 165, MSFT: 395, GOOGL: 170 },
      { month: 'May', AAPL: 191, MSFT: 430, GOOGL: 175 },
      { month: 'Jun', AAPL: 210, MSFT: 445, GOOGL: 185 },
      { month: 'Jul', AAPL: 218, MSFT: 455, GOOGL: 182 },
      { month: 'Aug', AAPL: 226, MSFT: 430, GOOGL: 178 },
      { month: 'Sep', AAPL: 233, MSFT: 442, GOOGL: 165 },
      { month: 'Oct', AAPL: 229, MSFT: 450, GOOGL: 172 },
      { month: 'Nov', AAPL: 237, MSFT: 465, GOOGL: 185 },
      { month: 'Dec', AAPL: 243, MSFT: 480, GOOGL: 190 },
    ],
  },
  {
    id: 'olympics', name: 'Paris 2024 Medals', emoji: '🥇',
    description: '10 countries · gold, silver, bronze',
    rows: [
      { country: 'USA',         gold: 40, silver: 44, bronze: 42 },
      { country: 'China',       gold: 40, silver: 27, bronze: 24 },
      { country: 'Japan',       gold: 20, silver: 12, bronze: 13 },
      { country: 'Australia',   gold: 18, silver: 19, bronze: 16 },
      { country: 'France',      gold: 16, silver: 26, bronze: 22 },
      { country: 'Netherlands', gold: 15, silver: 7,  bronze: 12 },
      { country: 'UK',          gold: 14, silver: 22, bronze: 29 },
      { country: 'South Korea', gold: 13, silver: 9,  bronze: 10 },
      { country: 'Germany',     gold: 12, silver: 13, bronze: 8  },
      { country: 'Italy',       gold: 12, silver: 13, bronze: 15 },
    ],
  },
  {
    id: 'saas', name: 'SaaS Metrics', emoji: '🚀',
    description: '12 months · MRR, churn, NPS, users',
    rows: [
      { month: 'Jan', mrr: 12000,  churn: 2.1, nps: 42, users: 450  },
      { month: 'Feb', mrr: 14500,  churn: 1.8, nps: 45, users: 510  },
      { month: 'Mar', mrr: 16200,  churn: 2.3, nps: 44, users: 580  },
      { month: 'Apr', mrr: 18900,  churn: 1.9, nps: 48, users: 640  },
      { month: 'May', mrr: 21300,  churn: 1.6, nps: 51, users: 720  },
      { month: 'Jun', mrr: 24100,  churn: 1.4, nps: 53, users: 810  },
      { month: 'Jul', mrr: 27800,  churn: 1.7, nps: 50, users: 920  },
      { month: 'Aug', mrr: 31200,  churn: 1.5, nps: 55, users: 1050 },
      { month: 'Sep', mrr: 35600,  churn: 1.3, nps: 58, users: 1180 },
      { month: 'Oct', mrr: 40100,  churn: 1.2, nps: 61, users: 1320 },
      { month: 'Nov', mrr: 45800,  churn: 1.1, nps: 63, users: 1500 },
      { month: 'Dec', mrr: 52000,  churn: 1.0, nps: 65, users: 1680 },
    ],
  },
]

// ─── Share URL utilities ───────────────────────────────────────────────────────

function encodeShare(obj) {
  try {
    const json = JSON.stringify(obj)
    const bytes = new TextEncoder().encode(json)
    const b64 = btoa(String.fromCharCode(...bytes))
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  } catch { return null }
}

function decodeShare(str) {
  try {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch { return null }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function detectType(values) {
  const nonEmpty = values.filter(v => v !== null && v !== '' && v !== undefined)
  if (!nonEmpty.length) return 'categorical'
  const isNum = v => !isNaN(Number(String(v).replace(/[$,%\s]/g, ''))) && String(v).trim() !== ''
  if (nonEmpty.every(isNum)) return 'numeric'
  const dateRe = /^\d{4}[-/]\d{1,2}|^\d{1,2}\/\d{1,2}\/\d{2,4}|^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i
  if (nonEmpty.slice(0, 20).some(v => dateRe.test(String(v)))) return 'date'
  return 'categorical'
}

function inferColumns(rows) {
  if (!rows.length) return []
  // Sample at most 500 rows evenly so type detection is O(1) regardless of dataset size
  const sample = rows.length <= 500
    ? rows
    : Array.from({ length: 500 }, (_, i) => rows[Math.floor(i * rows.length / 500)])
  return Object.keys(rows[0]).map(name => ({
    name,
    type: detectType(sample.map(r => r[name])),
  }))
}

function resolveCol(name, columns) {
  if (!name) return name
  const exact = columns.find(c => c.name === name)
  if (exact) return exact.name
  const ci = columns.find(c => c.name.toLowerCase() === String(name).toLowerCase())
  return ci ? ci.name : name
}

function normalizeConfig(cfg, columns) {
  return {
    ...cfg,
    xAxis: resolveCol(cfg.xAxis, columns),
    yAxis: Array.isArray(cfg.yAxis)
      ? cfg.yAxis.map(y => resolveCol(y, columns))
      : resolveCol(cfg.yAxis, columns),
    groupBy: resolveCol(cfg.groupBy, columns),
    filter: cfg.filter?.column
      ? { column: resolveCol(cfg.filter.column, columns), values: cfg.filter.values ?? [] }
      : null,
  }
}

function pivotGroupBy(data, xAxis, groupBy, valueCol) {
  const groups = [...new Set(data.map(d => String(d[groupBy] ?? '')))]
  const xVals  = [...new Set(data.map(d => String(d[xAxis]  ?? '')))]
  // Build a Map keyed by "xVal|||groupVal" for O(1) lookup instead of O(n) find per cell
  const lookup = new Map()
  data.forEach(d => {
    lookup.set(`${String(d[xAxis] ?? '')}|||${String(d[groupBy] ?? '')}`, Number(d[valueCol]) || 0)
  })
  return {
    groups,
    pivoted: xVals.map(xv => {
      const row = { [xAxis]: xv }
      groups.forEach(g => { row[g] = lookup.get(`${xv}|||${g}`) ?? 0 })
      return row
    }),
  }
}

function aggregateData(rows, config, columns) {
  const { chartType, xAxis, yAxis, groupBy, aggregation } = config
  if (!xAxis || aggregation === 'none') return rows

  const yAxes = Array.isArray(yAxis) ? yAxis : [yAxis].filter(Boolean)

  if (chartType === 'heatmap') {
    const rowAxis = yAxes[0]
    const numCols = columns
      .filter(c => c.type === 'numeric' && c.name !== xAxis && c.name !== rowAxis)
      .map(c => c.name)
    // Streaming: accumulate sum + count per cell instead of pushing to arrays
    const groups = {}
    rows.forEach(row => {
      const key = `${row[xAxis]}|||${row[rowAxis]}`
      if (!groups[key]) {
        groups[key] = { [xAxis]: row[xAxis], [rowAxis]: row[rowAxis], _count: 0, _sum: {}, _cnt: {} }
        numCols.forEach(c => { groups[key]._sum[c] = 0; groups[key]._cnt[c] = 0 })
      }
      groups[key]._count++
      numCols.forEach(c => {
        const n = Number(row[c])
        if (!isNaN(n)) { groups[key]._sum[c] += n; groups[key]._cnt[c]++ }
      })
    })
    return Object.values(groups).map(g => {
      const res = { [xAxis]: g[xAxis], [yAxes[0]]: g[rowAxis], _count: g._count }
      numCols.forEach(c => {
        const cnt = g._cnt[c]
        if (!cnt) { res[c] = 0; return }
        if (aggregation === 'sum')      res[c] = g._sum[c]
        else if (aggregation === 'avg') res[c] = g._sum[c] / cnt
        else res[c] = g._count
      })
      return res
    })
  }

  // Streaming: accumulate sum/count/first per group instead of collecting _rows
  const groups = {}
  rows.forEach(row => {
    const xVal = row[xAxis]
    const gKey = groupBy ? `${xVal}|||${row[groupBy]}` : String(xVal ?? '')
    if (!groups[gKey]) {
      const acc = { [xAxis]: xVal, _count: 0, _sum: {}, _cnt: {}, _first: {} }
      if (groupBy) acc[groupBy] = row[groupBy]
      yAxes.forEach(col => { if (col) { acc._sum[col] = 0; acc._cnt[col] = 0; acc._first[col] = undefined } })
      groups[gKey] = acc
    }
    const acc = groups[gKey]
    acc._count++
    yAxes.forEach(col => {
      if (!col) return
      const n = Number(row[col])
      if (!isNaN(n)) {
        acc._sum[col] += n
        acc._cnt[col]++
        if (acc._first[col] === undefined) acc._first[col] = n
      }
    })
  })

  return Object.values(groups).map(acc => {
    const res = { [xAxis]: acc[xAxis] }
    if (groupBy) res[groupBy] = acc[groupBy]
    yAxes.forEach(col => {
      if (!col) return
      const cnt = acc._cnt[col]
      if (aggregation === 'sum')        res[col] = acc._sum[col]
      else if (aggregation === 'avg')   res[col] = cnt ? acc._sum[col] / cnt : 0
      else if (aggregation === 'count') res[col] = acc._count
      else                              res[col] = acc._first[col] ?? 0
    })
    return res
  })
}

function fmtTick(v) {
  if (typeof v !== 'number') return v
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (Math.abs(v) >= 1_000)     return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return v % 1 === 0 ? String(v) : v.toFixed(1)
}

function fmtTooltipVal(v) {
  if (typeof v !== 'number') return v
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(2).replace(/\.?0+$/, '') + 'M'
  if (Math.abs(v) >= 1_000)     return (v / 1_000).toFixed(2).replace(/\.?0+$/, '') + 'K'
  return v % 1 === 0 ? v.toLocaleString() : +v.toFixed(3)
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ values, color = '#6366f1' }) {
  const pts = values.length > 40
    ? Array.from({ length: 40 }, (_, i) => values[Math.floor(i * values.length / 40)])
    : values
  if (pts.length < 2) return null
  const min = Math.min(...pts), max = Math.max(...pts)
  const range = max - min || 1
  const W = 64, H = 22
  const coords = pts.map((v, i) => [
    Math.round((i / (pts.length - 1)) * W),
    Math.round(H - 2 - ((v - min) / range) * (H - 5)),
  ])
  const d = coords.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ')
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round"
        strokeLinejoin="round" opacity="0.5" />
    </svg>
  )
}

function getFollowUps(config, columns) {
  const { chartType, xAxis, groupBy } = config
  const out = []
  const typeAlts = { bar: 'line', line: 'area', area: 'bar', pie: 'donut', donut: 'bar', scatter: 'bubble', bubble: 'scatter' }
  if (typeAlts[chartType]) out.push(`Change to ${typeAlts[chartType]} chart`)
  const catCols = columns.filter(c => c.type === 'categorical' && c.name !== xAxis && c.name !== groupBy)
  if (catCols.length && !groupBy) out.push(`Group by ${catCols[0].name}`)
  else if (groupBy) out.push('Remove grouping')
  if (!['pie', 'donut', 'heatmap', 'scatter', 'bubble'].includes(chartType)) {
    out.push('Sort by highest value')
  }
  out.push('Show top 10 results')
  return out.slice(0, 3)
}

// ─── LLM ──────────────────────────────────────────────────────────────────────

function buildSystemPrompt(columns, rows) {
  const schema = columns.map(c => `${c.name} (${c.type})`).join(', ')
  const sample = rows.slice(0, 5).map(r => JSON.stringify(r)).join('\n')
  return `You are a data visualization expert. Return ONLY a valid JSON object — no markdown, no explanation.

JSON schema:
{
  "chartType": "bar"|"line"|"area"|"scatter"|"bubble"|"pie"|"donut"|"heatmap"|"composed",
  "title": "concise descriptive title",
  "xAxis": "exact column name",
  "yAxis": "exact column name OR array of column names",
  "groupBy": "exact column name or null",
  "aggregation": "sum"|"avg"|"count"|"none",
  "colorBy": "exact column name or null",
  "filter": {"column": "exact column name", "values": ["value1", "value2"]} or null,
  "insight": "one sentence plain-English insight"
}

Rules:
- Use EXACT column names from the dataset
- bar/line/area: xAxis = category or date, yAxis = numeric col(s)
- scatter: xAxis & yAxis = two numeric cols, aggregation = "none"
- bubble: xAxis = numeric, yAxis = [y_col, size_col], aggregation = "none"
- pie/donut: xAxis = category, yAxis = single numeric col
- heatmap: xAxis = first categorical, yAxis = second categorical
- composed: yAxis = array; first → bars, rest → lines
- groupBy creates grouped/multi-series charts
- Prefer date cols on xAxis for trend queries
- Use filter when the user specifies particular items to include (e.g. "compare USA and China", "only show Q1 and Q2")

Dataset columns: ${schema}
Sample rows:
${sample}`
}

async function queryLLM(messages, userKey) {
  if (!userKey) {
    const res = await fetch('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    })
    const data = await res.json()
    if (!res.ok) {
      const err = new Error(data.error || `Server error ${res.status}`)
      err.status = res.status
      throw err
    }
    return data.content
  }
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${userKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages,
      temperature: 0.1,
      max_tokens: 600,
      response_format: { type: 'json_object' },
    }),
  })
  const data = await res.json()
  if (!res.ok) {
    const err = new Error(data.error?.message || `Groq error ${res.status}`)
    err.status = res.status
    throw err
  }
  return data.choices[0].message.content
}

async function generateSuggestions(columns, rows, userKey) {
  const messages = [
    {
      role: 'system',
      content: buildSystemPrompt(columns, rows),
    },
    {
      role: 'user',
      content: `You are an expert data visualization consultant. Based on this dataset, suggest 5 questions that would each produce a genuinely insightful chart. For each question, you already know internally which chartType, xAxis, yAxis, and aggregation would answer it best — but write each question as plain, natural English that a non-technical person would ask out loud. No query syntax, no column name operators, no chart type labels in the question text. Write questions people actually say: "Which player scored the most?", "How did revenue trend over the year?", "What does the score distribution look like?". Vary the chart types across your 5 suggestions. Return ONLY valid JSON: {"suggestions":["q1","q2","q3","q4","q5"]}`,
    },
  ]
  const raw = await queryLLM(messages, userKey)
  const parsed = JSON.parse(raw)
  return Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 5) : []
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function Logo({ size = 22 }) {
  return (
    <svg width={Math.round(size * 1.27)} height={size} viewBox="0 0 28 22" fill="none" aria-hidden="true">
      <path d="M2 17 Q8 5 14 10 Q20 15 26 3" stroke="#6366f1" strokeWidth="2.2"
        fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 20 Q8 8 14 13 Q20 18 26 6" stroke="#6366f1" strokeWidth="1.3"
        fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.35" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 1.5V3M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M13.5 9.5A6 6 0 016.5 2.5a5.5 5.5 0 100 11 6 6 0 007-4z"
        stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  )
}

function FullscreenIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M1 1h4M1 1v4M15 1h-4M15 1v4M1 15h4M1 15v-4M15 15h-4M15 15v-4"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ backgroundColor: 'var(--sf)', border: '1px solid var(--ln2)', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.22)', padding: '10px 14px', minWidth: 120 }}>
      {label !== undefined && label !== '' && (
        <p style={{ fontSize: 11, color: 'var(--t4)', marginBottom: 8, fontWeight: 500 }}>{label}</p>
      )}
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: i < payload.length - 1 ? 4 : 0 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0, display: 'inline-block' }} />
          <span style={{ fontSize: 11, color: 'var(--t3)', flex: 1 }}>{p.name}</span>
          <span style={{ fontSize: 12, color: 'var(--t1)', fontWeight: 600, marginLeft: 12, fontVariantNumeric: 'tabular-nums' }}>
            {fmtTooltipVal(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Error Boundary ───────────────────────────────────────────────────────────

class ChartErrorBoundary extends React.Component {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(err) { console.warn('Chart render error:', err) }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-40 text-center">
          <div>
            <p className="text-[var(--t3)] font-medium mb-1">Chart couldn't render</p>
            <p className="text-[12px] text-[var(--t4)]">Try rephrasing your query or a different chart type</p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── Heatmap ──────────────────────────────────────────────────────────────────

function HeatmapChart({ data, config, columns }) {
  const { xAxis, yAxis } = config
  const rowAxis = Array.isArray(yAxis) ? yAxis[0] : yAxis
  const xVals = [...new Set(data.map(d => d[xAxis]))]
  const yVals = [...new Set(data.map(d => d[rowAxis]))]
  const valueCol =
    columns.find(c => c.type === 'numeric' && c.name !== xAxis && c.name !== rowAxis)?.name || '_count'
  const nums = data.map(d => Number(d[valueCol] ?? d._count ?? 0)).filter(v => !isNaN(v))
  const minVal = Math.min(...nums, 0)
  const maxVal = Math.max(...nums, 1)
  const colorScale = d3.scaleSequential(d3.interpolateBlues).domain([minVal, maxVal])
  const cellW = Math.max(44, Math.min(100, Math.floor(560 / Math.max(xVals.length, 1))))
  const cellH = 38
  const mL = 110, mT = 56
  const svgW = mL + xVals.length * cellW + 20
  const svgH = mT + yVals.length * cellH + 20

  return (
    <div className="overflow-x-auto w-full">
      <svg width={svgW} height={svgH}>
        {xVals.map((xv, xi) => (
          <text key={xi} x={mL + xi * cellW + cellW / 2} y={mT - 10}
            textAnchor="middle" fontSize={10} fill="var(--t3)"
            transform={`rotate(-35,${mL + xi * cellW + cellW / 2},${mT - 10})`}>
            {String(xv).slice(0, 14)}
          </text>
        ))}
        {yVals.map((yv, yi) => (
          <text key={yi} x={mL - 8} y={mT + yi * cellH + cellH / 2 + 4}
            textAnchor="end" fontSize={10} fill="var(--t3)">
            {String(yv).slice(0, 16)}
          </text>
        ))}
        {yVals.map((yv, yi) =>
          xVals.map((xv, xi) => {
            const row = data.find(d => String(d[xAxis]) === String(xv) && String(d[rowAxis]) === String(yv))
            const val = row ? Number(row[valueCol] ?? row._count ?? 0) : 0
            const lightness = (val - minVal) / (maxVal - minVal || 1)
            return (
              <g key={`${xi}-${yi}`}>
                <rect x={mL + xi * cellW} y={mT + yi * cellH}
                  width={cellW - 2} height={cellH - 2}
                  fill={isNaN(val) ? 'var(--sf2)' : colorScale(val)} rx={3} />
                <text x={mL + xi * cellW + cellW / 2} y={mT + yi * cellH + cellH / 2 + 4}
                  textAnchor="middle" fontSize={9}
                  fill={lightness > 0.55 ? '#111' : '#eee'}>
                  {isNaN(val) ? '' : val % 1 === 0 ? val : val.toFixed(1)}
                </text>
              </g>
            )
          })
        )}
      </svg>
    </div>
  )
}

// ─── Chart Renderer ───────────────────────────────────────────────────────────

function ChartRenderer({ config, data, columns, height = 360, colors = PALETTES.datadropai, showAvgLine = false }) {
  const { chartType, xAxis, yAxis, groupBy } = config
  const yAxes = Array.isArray(yAxis) ? yAxis : [yAxis].filter(Boolean)
  const ax   = { stroke: 'var(--ln2)', tick: { fill: 'var(--t3)', fontSize: 11 } }
  const mg   = { top: 8, right: 24, bottom: 8, left: 12 }
  const grid = <CartesianGrid strokeDasharray="3 3" stroke="var(--ln)" />
  const leg  = <Legend wrapperStyle={{ color: 'var(--t3)', fontSize: 11 }} />
  // Shared animation props — snappy ease-out feels responsive without being jarring
  const barAnim  = { isAnimationActive: true, animationDuration: 500, animationEasing: 'ease-out' }
  const lineAnim = { isAnimationActive: true, animationDuration: 700, animationEasing: 'ease-in-out' }

  // Average reference line — computed across first yAxis
  const _yKey = Array.isArray(yAxes) ? yAxes[0] : yAxes
  const _yNums = showAvgLine && _yKey ? data.map(d => Number(d[_yKey])).filter(v => !isNaN(v)) : []
  const avgVal = _yNums.length ? _yNums.reduce((a, b) => a + b, 0) / _yNums.length : null
  const avgLine = showAvgLine && avgVal !== null
    ? <ReferenceLine y={avgVal} stroke="var(--afg)" strokeDasharray="5 3" strokeWidth={1.5}
        label={{ value: `avg ${fmtTick(avgVal)}`, position: 'insideTopRight', fontSize: 9, fill: 'var(--afg)', dy: -4 }} />
    : null

  if (chartType === 'bar') {
    const isH = data.length > 9
    if (groupBy) {
      const { groups, pivoted } = pivotGroupBy(data, xAxis, groupBy, yAxes[0])
      return (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={pivoted} layout={isH ? 'vertical' : 'horizontal'} margin={mg}>
            {grid}
            {isH
              ? (<><XAxis type="number" {...ax} tickFormatter={fmtTick} /><YAxis dataKey={xAxis} type="category" {...ax} width={110} /></>)
              : (<><XAxis dataKey={xAxis} {...ax} /><YAxis {...ax} tickFormatter={fmtTick} /></>)}
            <Tooltip content={<CustomTooltip />} />
            {leg}
            {groups.map((g, i) => <Bar key={g} dataKey={g} fill={colors[i % colors.length]} radius={isH ? [0,3,3,0] : [3,3,0,0]} {...barAnim} />)}
            {avgLine}
          </BarChart>
        </ResponsiveContainer>
      )
    }
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout={isH ? 'vertical' : 'horizontal'} margin={mg}>
          {grid}
          {isH
            ? (<><XAxis type="number" {...ax} tickFormatter={fmtTick} /><YAxis dataKey={xAxis} type="category" {...ax} width={110} /></>)
            : (<><XAxis dataKey={xAxis} {...ax} /><YAxis {...ax} tickFormatter={fmtTick} /></>)}
          <Tooltip content={<CustomTooltip />} />
          {leg}
          {yAxes.map((col, i) => <Bar key={col} dataKey={col} fill={colors[i % colors.length]} radius={isH ? [0,3,3,0] : [3,3,0,0]} {...barAnim} />)}
          {avgLine}
        </BarChart>
      </ResponsiveContainer>
    )
  }

  if (chartType === 'line') {
    const { pivoted, groups: grps } = groupBy ? pivotGroupBy(data, xAxis, groupBy, yAxes[0]) : {}
    const renderData = groupBy ? pivoted : data
    const keys = groupBy ? grps : yAxes
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={renderData} margin={mg}>
          {grid}
          <XAxis dataKey={xAxis} {...ax} />
          <YAxis {...ax} tickFormatter={fmtTick} />
          <Tooltip content={<CustomTooltip />} />
          {leg}
          {keys.map((col, i) => (
            <Line key={col} type="monotone" dataKey={col} stroke={colors[i % colors.length]}
              strokeWidth={2} dot={data.length < 40 ? { r: 2.5, fill: colors[i % colors.length] } : false}
              activeDot={{ r: 5 }} {...lineAnim} />
          ))}
          {avgLine}
        </LineChart>
      </ResponsiveContainer>
    )
  }

  if (chartType === 'area') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={mg}>
          <defs>
            {yAxes.map((_, i) => (
              <linearGradient key={i} id={`ag${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={colors[i % colors.length]} stopOpacity={0.3} />
                <stop offset="95%" stopColor={colors[i % colors.length]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          {grid}
          <XAxis dataKey={xAxis} {...ax} />
          <YAxis {...ax} tickFormatter={fmtTick} />
          <Tooltip content={<CustomTooltip />} />
          {leg}
          {yAxes.map((col, i) => (
            <Area key={col} type="monotone" dataKey={col}
              stroke={colors[i % colors.length]} fill={`url(#ag${i})`} strokeWidth={2} {...lineAnim} />
          ))}
          {avgLine}
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  if (chartType === 'scatter') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart margin={mg}>
          {grid}
          <XAxis dataKey={xAxis} {...ax} name={xAxis} tickFormatter={fmtTick} />
          <YAxis dataKey={yAxes[0]} {...ax} name={yAxes[0]} tickFormatter={fmtTick} />
          <Tooltip contentStyle={TT} cursor={{ strokeDasharray: '3 3', stroke: 'var(--ln3)' }} />
          <Scatter data={data} fill={colors[0]} fillOpacity={0.75} />
        </ScatterChart>
      </ResponsiveContainer>
    )
  }

  if (chartType === 'bubble') {
    const sizeCol = yAxes[1] || yAxes[0]
    return (
      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart margin={mg}>
          {grid}
          <XAxis dataKey={xAxis} {...ax} name={xAxis} tickFormatter={fmtTick} />
          <YAxis dataKey={yAxes[0]} {...ax} name={yAxes[0]} tickFormatter={fmtTick} />
          <ZAxis dataKey={sizeCol} range={[30, 700]} name={sizeCol} />
          <Tooltip contentStyle={TT} cursor={{ strokeDasharray: '3 3', stroke: 'var(--ln3)' }} />
          <Scatter data={data} fill={colors[0]} fillOpacity={0.55} />
        </ScatterChart>
      </ResponsiveContainer>
    )
  }

  if (chartType === 'pie' || chartType === 'donut') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} dataKey={yAxes[0]} nameKey={xAxis}
            cx="50%" cy="50%"
            innerRadius={chartType === 'donut' ? 80 : 0}
            outerRadius={Math.min(height / 2 - 40, 140)}
            paddingAngle={2}
            isAnimationActive={true} animationDuration={700} animationEasing="ease-in-out"
            label={({ name, percent }) => `${String(name).slice(0, 12)} ${(percent * 100).toFixed(0)}%`}
            labelLine={{ stroke: 'var(--ln3)' }}>
            {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          {leg}
        </PieChart>
      </ResponsiveContainer>
    )
  }

  if (chartType === 'heatmap') {
    return <HeatmapChart data={data} config={config} columns={columns} />
  }

  if (chartType === 'composed') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={mg}>
          {grid}
          <XAxis dataKey={xAxis} {...ax} />
          <YAxis {...ax} tickFormatter={fmtTick} />
          <Tooltip content={<CustomTooltip />} />
          {leg}
          {yAxes.map((col, i) =>
            i === 0
              ? <Bar key={col} dataKey={col} fill={colors[0]} radius={[3,3,0,0]} fillOpacity={0.85} {...barAnim} />
              : <Line key={col} type="monotone" dataKey={col} stroke={colors[i % colors.length]} strokeWidth={2} dot={false} {...lineAnim} />
          )}
          {avgLine}
        </ComposedChart>
      </ResponsiveContainer>
    )
  }

  return (
    <div className="flex items-center justify-center h-40 text-[var(--t4)] text-sm">
      Unknown chart type: {chartType}
    </div>
  )
}

// ─── Theme Toggle ─────────────────────────────────────────────────────────────

function ThemeToggle({ theme, onToggle }) {
  return (
    <button
      onClick={onToggle}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--ln2)] text-[var(--t3)] hover:text-[var(--t1)] hover:border-[var(--ln3)] transition-colors"
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}

// ─── Palette Picker ───────────────────────────────────────────────────────────

function PalettePicker({ palette, onPalette }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function close(e) { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Color palette"
        className="flex items-center gap-1 text-[11px] bg-[var(--sf2)] border border-[var(--ln2)] hover:border-[var(--ln3)] text-[var(--t3)] hover:text-[var(--t1)] px-2.5 py-1.5 rounded-lg transition-colors"
      >
        <span className="flex gap-0.5">
          {PALETTES[palette].slice(0, 4).map((c, i) => (
            <span key={i} style={{ background: c }} className="w-2.5 h-2.5 rounded-full block shrink-0" />
          ))}
        </span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-[var(--sf)] border border-[var(--ln2)] rounded-xl p-1.5 z-40 shadow-xl min-w-[152px]">
          {Object.entries(PALETTE_NAMES).map(([k, name]) => (
            <button key={k} onClick={() => { onPalette(k); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] transition-colors ${
                palette === k
                  ? 'bg-[var(--sf2)] text-[var(--t1)]'
                  : 'text-[var(--t3)] hover:text-[var(--t1)] hover:bg-[var(--sf2)]'
              }`}>
              <span className="flex gap-0.5 shrink-0">
                {PALETTES[k].slice(0, 5).map((c, i) => (
                  <span key={i} style={{ background: c }} className="w-2 h-2 rounded-full block" />
                ))}
              </span>
              <span>{name}</span>
              {palette === k && <span className="ml-auto text-[var(--afg)] text-[10px]">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Stats Strip ─────────────────────────────────────────────────────────────

function StatsStrip({ rows, columns }) {
  const numCols = columns.filter(c => c.type === 'numeric')
  const catCols = columns.filter(c => c.type === 'categorical')
  if (!numCols.length && !catCols.length) return null

  function fmt(n) {
    if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
    if (Math.abs(n) >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
    return n % 1 === 0 ? String(n) : n.toFixed(2)
  }

  const numStats = numCols.map(col => {
    // Single-pass streaming: avoids O(n) array creation + Math.min/max spread stack-overflow
    let min = Infinity, max = -Infinity, sum = 0, cnt = 0, nulls = 0
    // Sample up to 120 evenly-spaced points for the sparkline (no full-array copy)
    const SPARK_MAX = 120
    const sparkStep = rows.length > SPARK_MAX ? rows.length / SPARK_MAX : 1
    const sparkPts = []
    rows.forEach((r, i) => {
      const n = Number(r[col.name])
      if (isNaN(n)) { nulls++; return }
      if (n < min) min = n
      if (n > max) max = n
      sum += n
      cnt++
      if (i === Math.floor(sparkPts.length * sparkStep)) sparkPts.push(n)
    })
    if (sparkPts.length < cnt && cnt <= SPARK_MAX) {
      // small dataset — fill sparkPts properly (already collected above is fine)
    }
    return {
      name: col.name,
      min:  cnt ? min : 0,
      max:  cnt ? max : 0,
      avg:  cnt ? sum / cnt : 0,
      nulls,
      sparkPts,
    }
  })

  const catStats = catCols.slice(0, 4).map(col => {
    const counts = {}
    rows.forEach(r => { const v = String(r[col.name] ?? '—'); counts[v] = (counts[v] || 0) + 1 })
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4)
    return { name: col.name, top, unique: Object.keys(counts).length }
  })

  return (
    <div>
      <p className="text-[11px] text-[var(--t4)] font-medium uppercase tracking-wider mb-2">Column stats</p>
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {numStats.map(s => (
          <div key={s.name}
            className="shrink-0 bg-[var(--sf)] border border-[var(--ln)] hover:border-[var(--ln3)] hover:-translate-y-px rounded-xl px-3.5 py-3 min-w-[148px] transition-all">
            <div className="flex items-start justify-between gap-2 mb-2.5">
              <p className="text-[11px] font-medium text-[var(--t2)] truncate">{s.name}</p>
              <Sparkline values={s.sparkPts} />
            </div>
            <div className="grid grid-cols-3 gap-x-2">
              {[['min', s.min], ['avg', s.avg], ['max', s.max]].map(([label, val]) => (
                <div key={label}>
                  <p className="text-[9px] text-[var(--t4)] uppercase tracking-wider mb-0.5">{label}</p>
                  <p className="text-[12px] font-semibold text-[var(--t1)]">{fmt(val)}</p>
                </div>
              ))}
            </div>
            {s.nulls > 0 && (
              <p className="text-[10px] text-[var(--t4)] mt-2">
                {s.nulls} null{s.nulls !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        ))}
        {catStats.map(s => (
          <div key={s.name}
            className="shrink-0 bg-[var(--sf)] border border-[var(--ln)] hover:border-[var(--ln3)] hover:-translate-y-px rounded-xl px-3.5 py-3 min-w-[160px] transition-all">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[11px] font-medium text-[var(--t2)] truncate max-w-[110px]">{s.name}</p>
              <span className="text-[9px] text-[var(--t5)] shrink-0">{s.unique} unique</span>
            </div>
            <div className="space-y-1.5">
              {s.top.map(([val, count]) => (
                <div key={val} className="flex items-center gap-2">
                  <div className="flex-1 relative h-1 bg-[var(--ln)] rounded-full overflow-hidden">
                    <div className="absolute inset-y-0 left-0 bg-[#6366f1]/45 rounded-full transition-all"
                      style={{ width: `${(count / (s.top[0][1] || 1)) * 100}%` }} />
                  </div>
                  <span className="text-[9px] text-[var(--t3)] truncate max-w-[72px] shrink-0">{val}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Data Table ───────────────────────────────────────────────────────────────

const TABLE_ROW_LIMIT = 500

function DataTable({ data }) {
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)

  if (!data.length) return null
  const cols = Object.keys(data[0]).filter(k => !k.startsWith('_'))

  function handleSort(col) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const filtered = search
    ? data.filter(row => cols.some(c => String(row[c] ?? '').toLowerCase().includes(search.toLowerCase())))
    : data

  const sorted = sortCol
    ? [...filtered].sort((a, b) => {
        const av = a[sortCol], bv = b[sortCol]
        const an = Number(av), bn = Number(bv)
        const cmp = !isNaN(an) && !isNaN(bn)
          ? an - bn
          : String(av ?? '').localeCompare(String(bv ?? ''))
        return sortDir === 'asc' ? cmp : -cmp
      })
    : filtered

  const displayed = showAll ? sorted : sorted.slice(0, TABLE_ROW_LIMIT)
  const hasMore = sorted.length > TABLE_ROW_LIMIT && !showAll

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          type="text"
          placeholder="Search rows…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-[var(--bg)] border border-[var(--ln2)] rounded-lg px-3 py-2 text-[12px] text-[var(--t2)] placeholder:text-[var(--t5)] focus:outline-none focus:border-[#6366f1]/40 transition-colors pr-8"
        />
        {search && (
          <button onClick={() => setSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--t4)] hover:text-[var(--t2)] transition-colors text-[11px]">✕</button>
        )}
      </div>
      <div className="overflow-x-auto rounded-xl border border-[var(--ln)]">
        <table className="text-[12px] w-full">
          <thead>
            <tr className="border-b border-[var(--ln)]">
              {cols.map(col => (
                <th key={col} onClick={() => handleSort(col)}
                  className="px-3 py-2.5 text-left text-[var(--t3)] font-medium whitespace-nowrap cursor-pointer hover:text-[var(--t1)] select-none transition-colors group">
                  {col}
                  <span className="ml-1 text-[var(--t5)] group-hover:text-[var(--t4)]">
                    {sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={cols.length} className="px-3 py-6 text-center text-[var(--t5)] text-[12px]">
                  No rows match "{search}"
                </td>
              </tr>
            ) : displayed.map((row, i) => (
              <tr key={i} className="border-b border-[var(--ln)] last:border-0 hover:bg-[var(--sf2)] transition-colors">
                {cols.map(col => (
                  <td key={col} className="px-3 py-2 text-[var(--t2)] whitespace-nowrap max-w-[200px] truncate">
                    {row[col] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-3 py-2 border-t border-[var(--ln)] text-[11px] text-[var(--t4)] flex items-center justify-between">
          <span>{sorted.length} row{sorted.length !== 1 ? 's' : ''}{search && data.length !== sorted.length ? ` of ${data.length} total` : ''}</span>
          {hasMore && (
            <button onClick={() => setShowAll(true)}
              className="text-[var(--afg)] hover:underline transition-colors">
              Show all {sorted.length.toLocaleString()} rows
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Landing Page ─────────────────────────────────────────────────────────────

function LandingPage({ onGetStarted, onSample, theme, onToggleTheme }) {
  return (
    <div className="min-h-screen bg-[var(--bg-d)] text-[var(--t1)] dot-grid">

      {/* Nav */}
      <nav className="sticky top-0 z-20 border-b border-[var(--ln)] backdrop-blur-md"
        style={{ backgroundColor: 'var(--nav-blur)' }}>
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo size={20} />
            <span className="text-[15px] font-semibold tracking-tight">DataDropAI</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            <button
              onClick={onGetStarted}
              className="text-[13px] font-medium bg-[var(--t1)] text-[var(--bg)] px-4 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
            >
              Open app
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative max-w-5xl mx-auto px-6 pt-24 pb-20 text-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div style={{ position: 'absolute', top: '0%', left: '50%', transform: 'translateX(-50%)', width: 700, height: 340, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(99,102,241,0.11) 0%, transparent 70%)', filter: 'blur(40px)' }} />
        </div>
        <div className="inline-flex items-center gap-2 bg-[#6366f1]/10 border border-[#6366f1]/20 text-[var(--afg)] text-[12px] px-3 py-1 rounded-full mb-8 font-medium">
          <span className="w-1.5 h-1.5 bg-[#6366f1] rounded-full inline-block" />
          Powered by Groq — free to use
        </div>

        <h1 className="text-[58px] sm:text-[76px] font-bold tracking-[-0.03em] leading-[0.92] mb-7">
          Ask your data
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-br from-[#818cf8] via-[#6366f1] to-[#4f46e5]">
            anything.
          </span>
        </h1>

        <p className="text-[var(--t3)] text-lg sm:text-xl max-w-lg mx-auto mb-10 leading-relaxed">
          Drop a CSV or Google Sheet. Type a question in plain English.
          Get a chart in seconds — no code, no setup.
        </p>

        <div className="flex items-center justify-center gap-3 flex-wrap">
          <button
            onClick={onGetStarted}
            className="bg-[#6366f1] hover:bg-[#5254cc] text-white text-[14px] font-medium px-6 py-3 rounded-xl transition-colors"
          >
            Upload your data →
          </button>
          <button
            onClick={() => onSample(SAMPLES[3])}
            className="text-[14px] text-[var(--t3)] hover:text-[var(--t1)] border border-[var(--ln2)] hover:border-[var(--ln3)] px-6 py-3 rounded-xl transition-colors"
          >
            Try a demo
          </button>
        </div>
      </section>

      {/* Sample cards */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <p className="text-center text-[11px] text-[var(--t4)] uppercase tracking-widest font-medium mb-5">
          Start with sample data
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {SAMPLES.map(s => (
            <button
              key={s.id}
              onClick={() => onSample(s)}
              className="group bg-[var(--sf)] border border-[var(--ln)] hover:border-[#6366f1]/40 hover:bg-[#6366f1]/5 rounded-2xl p-4 text-left transition-all"
            >
              <span className="text-3xl block mb-3">{s.emoji}</span>
              <p className="text-[13px] font-medium text-[var(--t2)] group-hover:text-[var(--t1)] transition-colors leading-snug">{s.name}</p>
              <p className="text-[11px] text-[var(--t4)] mt-1 leading-snug">{s.description}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-[var(--ln)] max-w-5xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
          {[
            {
              icon: (
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="8.5" stroke="#6366f1" strokeWidth="1.5"/>
                  <path d="M7 10l2 2 4-4" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ),
              title: 'Natural language queries',
              body: 'Type questions like "show sales by region as a bar chart" — the AI handles the rest.',
            },
            {
              icon: (
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <rect x="2" y="12" width="3" height="6" rx="1" fill="#6366f1"/>
                  <rect x="7" y="8" width="3" height="10" rx="1" fill="#6366f1" opacity="0.7"/>
                  <rect x="12" y="4" width="3" height="14" rx="1" fill="#6366f1" opacity="0.45"/>
                  <rect x="17" y="9" width="1.5" height="9" rx="0.75" fill="#6366f1" opacity="0.3"/>
                </svg>
              ),
              title: '9 chart types',
              body: 'Bar, line, area, scatter, bubble, pie, donut, heatmap, and composed charts.',
            },
            {
              icon: (
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <rect x="3" y="3" width="14" height="14" rx="3" stroke="#6366f1" strokeWidth="1.5"/>
                  <path d="M7 10h6M10 7v6" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              ),
              title: 'Your data stays private',
              body: 'Data never leaves your browser. Only your query text is sent to the AI.',
            },
          ].map(f => (
            <div key={f.title} className="space-y-3">
              <div className="w-9 h-9 bg-[#6366f1]/10 rounded-xl flex items-center justify-center">
                {f.icon}
              </div>
              <h3 className="text-[14px] font-semibold text-[var(--t1)]">{f.title}</h3>
              <p className="text-[13px] text-[var(--t3)] leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--ln)] max-w-5xl mx-auto px-6 py-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Logo size={15} />
          <span className="text-[13px] text-[var(--t4)]">DataDropAI</span>
        </div>
        <p className="text-[12px] text-[var(--t5)]">Groq · Recharts · Vite · Free & open source</p>
      </footer>
    </div>
  )
}

// ─── History Strip ────────────────────────────────────────────────────────────

function HistoryStrip({ chartHistory, onRestore }) {
  if (!chartHistory.length) return null
  return (
    <div className="space-y-2.5">
      <p className="text-[11px] text-[var(--t4)] font-medium uppercase tracking-wider">Recent queries</p>
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {chartHistory.map((item, i) => (
          <button
            key={i}
            onClick={() => onRestore(item)}
            className="shrink-0 bg-[var(--sf)] border border-[var(--ln)] hover:border-[var(--ln3)] hover:-translate-y-px rounded-xl px-3 py-2.5 text-left transition-all group w-44"
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-[10px] bg-[#6366f1]/10 text-[var(--afg)] px-1.5 py-0.5 rounded font-medium">
                {CHART_LABEL[item.config.chartType] || item.config.chartType}
              </span>
            </div>
            <p className="text-[12px] text-[var(--t3)] group-hover:text-[var(--t1)] leading-snug line-clamp-2 transition-colors">
              {item.config.title}
            </p>
            <p className="text-[10px] text-[var(--t5)] group-hover:text-[var(--t4)] mt-1 truncate transition-colors">{item.query}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard({ pins, onUnpin, onClose, colors, theme, onShare, dashCopied }) {
  async function exportReport() {
    const el = document.getElementById('dashboard-grid')
    if (!el) return
    try {
      const bg = theme === 'light' ? '#f5f5f5' : '#080808'
      const canvas = await html2canvas(el, { backgroundColor: bg, scale: 2, logging: false, useCORS: true })
      const link = document.createElement('a')
      link.download = `datadropai-report-${Date.now()}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch {}
  }

  if (!pins.length) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-24 text-center">
        <div className="w-12 h-12 bg-[var(--sf)] border border-[var(--ln)] rounded-2xl flex items-center justify-center mx-auto mb-4 text-xl">
          📌
        </div>
        <p className="text-[15px] font-medium text-[var(--t2)] mb-2">No pinned charts</p>
        <p className="text-[var(--t4)] text-sm max-w-xs mx-auto mb-6">
          Pin charts from the explore view to build a dashboard you can revisit.
        </p>
        <button onClick={onClose}
          className="text-[13px] bg-[#6366f1] hover:bg-[#5254cc] text-white px-5 py-2.5 rounded-xl transition-colors">
          ← Back to explore
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-[17px] font-semibold text-[var(--t1)]">Dashboard</h2>
          <p className="text-[var(--t4)] text-[13px] mt-0.5">{pins.length} pinned chart{pins.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportReport}
            className="text-[12px] text-[var(--t3)] hover:text-[var(--t1)] border border-[var(--ln)] hover:border-[var(--ln3)] px-3.5 py-2 rounded-xl transition-colors">
            Export report
          </button>
          <button onClick={onShare}
            className="text-[12px] text-[var(--t3)] hover:text-[var(--t1)] border border-[var(--ln)] hover:border-[var(--ln3)] px-3.5 py-2 rounded-xl transition-colors">
            {dashCopied ? '✓ Link copied' : 'Share dashboard'}
          </button>
          <button onClick={onClose}
            className="text-[12px] text-[var(--t3)] hover:text-[var(--t1)] border border-[var(--ln)] hover:border-[var(--ln3)] px-3.5 py-2 rounded-xl transition-colors">
            ← Explore
          </button>
        </div>
      </div>

      <div id="dashboard-grid" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {pins.map((pin, i) => (
          <div key={i} className="bg-[var(--sf)] border border-[var(--ln)] rounded-2xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-[var(--t1)] leading-snug truncate">{pin.config.title}</p>
                <p className="text-[11px] text-[var(--t4)] mt-0.5 truncate">{pin.query}</p>
              </div>
              <button onClick={() => onUnpin(i)}
                className="shrink-0 text-[11px] text-[var(--t4)] hover:text-red-400 border border-[var(--ln)] hover:border-red-400/30 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap">
                Remove
              </button>
            </div>
            <ChartErrorBoundary key={pin.config.title + i}>
              <ChartRenderer config={pin.config} data={pin.data} columns={pin.columns} height={240} colors={colors} />
            </ChartErrorBoundary>
            {pin.config.insight && (
              <p className="text-[11px] text-[var(--t4)] border-t border-[var(--ln)] pt-3 leading-relaxed">
                {pin.config.insight}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Data Input ───────────────────────────────────────────────────────────────

function DataInput({ onCSV, onJSON, onURL, onSample, onFile, onFiles }) {
  const [tab, setTab] = useState('upload')
  const [paste, setPaste] = useState('')
  const [url, setUrl] = useState('')
  const [dragging, setDragging] = useState(false)
  const [multiDragging, setMultiDragging] = useState(false)

  function readFile(file) {
    if (file.name.endsWith('.json')) {
      const reader = new FileReader()
      reader.onload = e => onJSON(e.target.result)
      reader.readAsText(file)
    } else {
      onFile(file)
    }
  }

  function handlePaste() {
    const t = paste.trim()
    if (t.startsWith('{') || t.startsWith('[')) onJSON(t)
    else onCSV(t)
  }

  function handleMultiDrop(e) {
    e.preventDefault()
    setMultiDragging(false)
    const files = e.dataTransfer.files
    if (files.length === 1 && !files[0].name.match(/\.(csv|tsv|txt)$/i)) return
    onFiles(files)
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* Sample datasets */}
      <div className="space-y-3">
        <p className="text-[11px] text-[var(--t4)] uppercase tracking-widest font-medium text-center">
          Try a sample dataset
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SAMPLES.map(s => (
            <button
              key={s.id}
              onClick={() => onSample(s)}
              className="group bg-[var(--sf)] border border-[var(--ln)] hover:border-[#6366f1]/40 hover:bg-[#6366f1]/5 rounded-xl p-3 text-left transition-all"
            >
              <div className="text-xl mb-1.5">{s.emoji}</div>
              <p className="text-[12px] font-medium text-[var(--t2)] group-hover:text-[var(--t1)] transition-colors">{s.name}</p>
              <p className="text-[10px] text-[var(--t4)] mt-0.5 leading-snug">{s.description}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-[var(--ln)]" />
        <span className="text-[11px] text-[var(--t5)]">or upload your own</span>
        <div className="flex-1 h-px bg-[var(--ln)]" />
      </div>

      <div className="space-y-3">
        <div className="flex gap-0.5 bg-[var(--sf)] border border-[var(--ln)] rounded-xl p-1 w-fit mx-auto">
          {[['upload', 'Single file'], ['multi', 'Folder / Multi'], ['paste', 'Paste data'], ['url', 'URL / Sheets']].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-3.5 py-1.5 text-[12px] rounded-lg transition-all ${
                tab === k
                  ? 'bg-[var(--sf2)] text-[var(--t1)]'
                  : 'text-[var(--t4)] hover:text-[var(--t2)]'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'upload' && (
          <div
            onDrop={e => { e.preventDefault(); setDragging(false); e.dataTransfer.files[0] && readFile(e.dataTransfer.files[0]) }}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onClick={() => document.getElementById('_fi').click()}
            className={`border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer select-none transition-all ${
              dragging
                ? 'border-[#6366f1] bg-[#6366f1]/5'
                : 'border-[var(--ln2)] hover:border-[var(--ln3)]'
            }`}
          >
            <div className="text-[var(--t4)] mb-3 text-xl">↑</div>
            <p className="text-[var(--t2)] text-sm mb-1 font-medium">Drop CSV, TSV, or JSON here</p>
            <p className="text-[var(--t4)] text-xs">or click to browse</p>
            <input id="_fi" type="file" accept=".csv,.tsv,.json,.txt" className="hidden"
              onChange={e => e.target.files[0] && readFile(e.target.files[0])} />
          </div>
        )}

        {tab === 'multi' && (
          <div className="space-y-3">
            <div
              onDrop={handleMultiDrop}
              onDragOver={e => { e.preventDefault(); setMultiDragging(true) }}
              onDragLeave={() => setMultiDragging(false)}
              className={`border-2 border-dashed rounded-2xl p-10 text-center select-none transition-all ${
                multiDragging
                  ? 'border-[#6366f1] bg-[#6366f1]/5'
                  : 'border-[var(--ln2)]'
              }`}
            >
              <div className="text-[var(--t4)] mb-3 text-2xl">⊞</div>
              <p className="text-[var(--t2)] text-sm mb-1 font-medium">Drop multiple CSV files here</p>
              <p className="text-[var(--t4)] text-xs mb-5">All files will be merged — a <code className="font-mono bg-[var(--sf2)] px-1 rounded">source_file</code> column is added automatically</p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => document.getElementById('_fi_multi').click()}
                  className="text-[13px] font-medium bg-[#6366f1] hover:bg-[#5254cc] text-white px-4 py-2 rounded-lg transition-colors">
                  Select files
                </button>
                <button
                  onClick={() => document.getElementById('_fi_folder').click()}
                  className="text-[13px] font-medium border border-[var(--ln2)] hover:border-[var(--ln3)] text-[var(--t2)] px-4 py-2 rounded-lg transition-colors">
                  Select folder
                </button>
              </div>
              <input id="_fi_multi" type="file" accept=".csv,.tsv,.txt" multiple className="hidden"
                onChange={e => e.target.files.length && onFiles(e.target.files)} />
              <input id="_fi_folder" type="file" accept=".csv,.tsv,.txt" className="hidden"
                webkitdirectory="" mozdirectory=""
                onChange={e => e.target.files.length && onFiles(e.target.files)} />
            </div>
            <p className="text-[11px] text-[var(--t5)] text-center">
              Files don't need identical columns — missing values are filled with blanks
            </p>
          </div>
        )}

        {tab === 'paste' && (
          <div className="space-y-2.5">
            <textarea value={paste} onChange={e => setPaste(e.target.value)}
              placeholder={'name,sales,region\nApple,4200,West\nBanana,3100,East'}
              className="w-full h-44 bg-[var(--sf)] border border-[var(--ln)] rounded-xl px-4 py-3 text-sm text-[var(--t1)] placeholder:text-[var(--t5)] focus:outline-none focus:border-[#6366f1]/50 font-mono resize-none transition-colors" />
            <button onClick={handlePaste} disabled={!paste.trim()}
              className="bg-[#6366f1] hover:bg-[#5254cc] disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm px-5 py-2 rounded-lg transition-colors">
              Load data
            </button>
          </div>
        )}

        {tab === 'url' && (
          <div className="space-y-2.5">
            <input type="url" value={url} onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && url.trim() && onURL(url.trim())}
              placeholder="https://docs.google.com/spreadsheets/d/… or any CSV / JSON URL"
              className="w-full bg-[var(--sf)] border border-[var(--ln)] rounded-xl px-4 py-3 text-sm text-[var(--t1)] placeholder:text-[var(--t4)] focus:outline-none focus:border-[#6366f1]/50 transition-colors" />
            <div className="flex items-center gap-3">
              <button onClick={() => url.trim() && onURL(url.trim())} disabled={!url.trim()}
                className="bg-[#6366f1] hover:bg-[#5254cc] disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm px-5 py-2 rounded-lg transition-colors">
                Fetch & load
              </button>
              <span className="text-[11px] text-[var(--t4)]">Google Sheets must be shared publicly</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage]               = useState('home')
  const [rows, setRows]               = useState([])
  const [columns, setColumns]         = useState([])
  const [dataLoaded, setDataLoaded]   = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [dataLabel, setDataLabel]     = useState('')

  const [query, setQuery]       = useState('')
  const [followUp, setFollowUp] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const [chartConfig, setChartConfig] = useState(null)
  const [chartData, setChartData]     = useState([])
  const [chartId, setChartId]         = useState(0)

  const [chartHistory, setChartHistory] = useState([])
  const [pins, setPins]                 = useState([])
  const [view, setView]                 = useState('explore')
  const [chartView, setChartView]       = useState('chart')

  const [suggestions, setSuggestions]               = useState([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)

  const [apiKey, setApiKey] = useState(() => localStorage.getItem('datadropai_key') || '')
  const [copied, setCopied] = useState(false)

  const [theme, setTheme] = useState(() => localStorage.getItem('datadropai_theme') || 'dark')

  const [palette, setPalette]           = useState('datadropai')
  const [fullscreen, setFullscreen]     = useState(false)
  const [rowWarning, setRowWarning]     = useState(false)
  const [parseLoading, setParseLoading] = useState(false)
  const [sampledNotice, setSampledNotice] = useState(null) // { total, shown } | null
  const [rateLimitEnd, setRateLimitEnd] = useState(0)
  const [rateLimitLeft, setRateLimitLeft] = useState(0)
  const [watermark, setWatermark]       = useState(true)
  const [exportOpen, setExportOpen]     = useState(false)
  const [dashCopied, setDashCopied]     = useState(false)
  const [toasts, setToasts]             = useState([])
  const [loadingMsg, setLoadingMsg]     = useState('')
  const [showAvgLine, setShowAvgLine]   = useState(false)

  const chartRef     = useRef(null)
  const queryInputRef = useRef(null)
  const exportMenuRef = useRef(null)

  const activeColors = PALETTES[palette] ?? PALETTES.datadropai

  function addToast(message, type = 'success') {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }

  // ── Theme ──
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light')
    } else {
      document.documentElement.classList.remove('light')
    }
    localStorage.setItem('datadropai_theme', theme)
  }, [theme])

  function toggleTheme() {
    setTheme(t => t === 'dark' ? 'light' : 'dark')
  }

  // ── Rate limit countdown ──
  useEffect(() => {
    if (!rateLimitEnd) return
    const tick = setInterval(() => {
      const left = Math.ceil((rateLimitEnd - Date.now()) / 1000)
      setRateLimitLeft(Math.max(0, left))
      if (left <= 0) setRateLimitEnd(0)
    }, 250)
    return () => clearInterval(tick)
  }, [rateLimitEnd])

  // ── Keyboard shortcuts ──
  useEffect(() => {
    function handleKey(e) {
      const tag = document.activeElement?.tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA'
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        queryInputRef.current?.focus()
        queryInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      if (e.key === 'Escape') {
        if (fullscreen) setFullscreen(false)
        else if (isInput) document.activeElement.blur()
      }
      if (e.key === 'f' && !isInput && !fullscreen && chartConfig) {
        setFullscreen(true)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [fullscreen])

  // ── Export menu click-outside ──
  useEffect(() => {
    if (!exportOpen) return
    function close(e) { if (!exportMenuRef.current?.contains(e.target)) setExportOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [exportOpen])

  // ── Auto-focus query input when data loads ──
  useEffect(() => {
    if (dataLoaded) setTimeout(() => queryInputRef.current?.focus(), 200)
  }, [dataLoaded])

  // ── AI suggestions ──
  useEffect(() => {
    if (!dataLoaded || !columns.length || !rows.length) return
    setSuggestionsLoading(true)
    setSuggestions([])
    generateSuggestions(columns, rows, apiKey.trim())
      .then(s => setSuggestions(s))
      .catch(() => setSuggestions([]))
      .finally(() => setSuggestionsLoading(false))
  }, [dataLoaded]) // intentionally runs once per data load

  // ── Mount: URL restore → dashboard restore → session restore ──
  useEffect(() => {
    const params = new URLSearchParams(location.search)

    const paramC = params.get('c')
    if (paramC) {
      const shared = decodeShare(paramC)
      if (
        shared && typeof shared === 'object' &&
        shared.config && typeof shared.config.chartType === 'string' &&
        Array.isArray(shared.data) && shared.data.length > 0 && shared.data.length <= 5000 &&
        Array.isArray(shared.columns)
      ) {
        setRows(shared.data)
        setColumns(shared.columns)
        setDataLoaded(true)
        setChartConfig(shared.config)
        setChartData(shared.data)
        setDataLabel('Shared chart')
        setPage('app')
        window.history.replaceState({}, '', location.pathname)
        return
      }
    }

    const paramD = params.get('d')
    if (paramD) {
      const shared = decodeShare(paramD)
      if (
        shared && typeof shared === 'object' &&
        Array.isArray(shared.pins) && shared.pins.length > 0 && shared.pins.length <= 20 &&
        shared.pins.every(p => p?.config && typeof p.config.chartType === 'string')
      ) {
        const first = shared.pins[0]
        setRows(first.data || [])
        setColumns(first.columns || [])
        setDataLoaded(true)
        setDataLabel('Shared dashboard')
        setPins(shared.pins)
        setPage('app')
        setView('dashboard')
        window.history.replaceState({}, '', location.pathname)
        return
      }
    }

    try {
      const saved = localStorage.getItem('datadropai_session')
      if (saved) {
        const s = JSON.parse(saved)
        // rows are never persisted — restore chart/pin state only
        if (s.columns?.length) {
          setRows([])
          setColumns(s.columns)
          setDataLoaded(true)
          setDataLabel(s.dataLabel || 'Restored session')
          if (s.chartConfig) setChartConfig(s.chartConfig)
          if (s.chartData?.length) setChartData(s.chartData)
          if (s.chartHistory?.length) setChartHistory(s.chartHistory)
          if (s.pins?.length) setPins(s.pins)
          if (s.query) setQuery(s.query)
          if (s.palette) setPalette(s.palette)
          setPage('app')
        }
      }
    } catch {}
  }, [])

  // ── Session save — raw rows are never persisted (privacy) ──
  useEffect(() => {
    if (!dataLoaded) return
    try {
      const session = {
        // rows intentionally omitted — raw user data should not persist in localStorage
        columns,
        dataLabel,
        chartConfig: chartConfig ?? null,
        chartData: chartData ?? [],
        chartHistory: chartHistory.slice(0, 5),
        pins: pins.map(p => ({ ...p, data: p.data?.slice(0, 500) })).slice(0, 10),
        query,
        palette,
      }
      localStorage.setItem('datadropai_session', JSON.stringify(session))
    } catch {}
  }, [dataLoaded, chartConfig, chartData, pins, chartHistory, palette])

  // ── Data helpers ──

  function loadData(newRows, label) {
    const cols = inferColumns(newRows)
    setRows(newRows)
    setColumns(cols)
    setDataLoaded(true)
    setPreviewOpen(false)
    setDataLabel(label)
    setError('')
    setChartConfig(null)
    setChartData([])
    setQuery('')
    setChartView('chart')
    setSuggestions([])
    setPage('app')
    setRowWarning(newRows.length > 10_000)
  }

  function loadCSV(text) {
    const result = Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: false })
    if (!result.data.length) { setError('Could not parse CSV — check the format.'); return }
    const cleaned = result.data.filter(row => Object.values(row).some(v => v !== ''))
    loadData(cleaned.map(r => Object.fromEntries(Object.entries(r).map(([k,v]) => [k, String(v)]))), 'Uploaded file')
  }

  // Non-blocking CSV parse: PapaParse worker mode accepts a File object directly
  function loadCSVFile(file) {
    setParseLoading(true)
    setError('')
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      worker: true,
      complete(result) {
        setParseLoading(false)
        if (!result.data.length) { setError('Could not parse CSV — check the format.'); return }
        const cleaned = result.data.filter(row => Object.values(row).some(v => v !== ''))
        loadData(cleaned.map(r => Object.fromEntries(Object.entries(r).map(([k,v]) => [k, String(v)]))), file.name)
      },
      error(err) {
        setParseLoading(false)
        setError('CSV parse error: ' + err.message)
      },
    })
  }

  // Multi-file / folder merge: parse all CSVs in parallel via workers, then union-merge
  function loadCSVFiles(files) {
    const csvFiles = Array.from(files).filter(f =>
      /\.(csv|tsv|txt)$/i.test(f.name)
    )
    if (!csvFiles.length) { setError('No CSV/TSV files found in the selection.'); return }

    setParseLoading(true)
    setError('')

    let pending = csvFiles.length
    const results = new Array(csvFiles.length).fill(null)
    let errored = false

    csvFiles.forEach((file, idx) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        worker: true,
        complete(result) {
          results[idx] = { file, data: result.data }
          pending--
          if (pending === 0 && !errored) finishMerge(results)
        },
        error(err) {
          if (!errored) {
            errored = true
            setParseLoading(false)
            setError(`Parse error in "${file.name}": ${err.message}`)
          }
        },
      })
    })

    function finishMerge(results) {
      // Union of all column names across every file, in order first seen
      const colOrder = []
      const colSeen = new Set()
      results.forEach(({ data }) => {
        if (data.length) {
          Object.keys(data[0]).forEach(k => {
            if (!colSeen.has(k)) { colSeen.add(k); colOrder.push(k) }
          })
        }
      })

      const merged = []
      results.forEach(({ file, data }) => {
        const sourceName = file.name.replace(/\.[^.]+$/, '')
        const cleaned = data.filter(row => Object.values(row).some(v => v !== ''))
        cleaned.forEach(row => {
          const r = { source_file: sourceName }
          colOrder.forEach(col => { r[col] = String(row[col] ?? '') })
          merged.push(r)
        })
      })

      setParseLoading(false)
      if (!merged.length) { setError('No data rows found across the selected files.'); return }

      const label = csvFiles.length === 1
        ? csvFiles[0].name
        : `${csvFiles.length} files merged`
      loadData(merged, label)
      addToast(`Merged ${csvFiles.length} file${csvFiles.length !== 1 ? 's' : ''} · ${merged.length.toLocaleString()} rows`)
    }
  }

  function loadJSON(text) {
    try {
      let parsed = JSON.parse(text)
      if (!Array.isArray(parsed)) {
        const arr = Object.values(parsed).find(Array.isArray)
        if (!arr) throw new Error('No top-level array found')
        parsed = arr
      }
      loadData(parsed.map(r => Object.fromEntries(Object.entries(r).map(([k,v]) => [k, String(v ?? '')]))), 'Uploaded file')
    } catch (e) { setError('Could not parse JSON: ' + e.message) }
  }

  async function loadURL(url) {
    setError('')
    try {
      let fetchUrl = url
      const sheetsMatch = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
      if (sheetsMatch) fetchUrl = `https://docs.google.com/spreadsheets/d/${sheetsMatch[1]}/export?format=csv`

      // Warn on plain HTTP (request travels unencrypted; also may expose local network)
      if (/^http:\/\//i.test(fetchUrl) && !/^http:\/\/localhost/i.test(fetchUrl)) {
        setError('Warning: this URL uses plain HTTP. Your request may be intercepted. Use HTTPS if possible.')
        // Don't block — user may have a legitimate local HTTP endpoint
      }

      const res = await fetch(fetchUrl)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      const trimmed = text.trimStart()
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) loadJSON(text)
      else loadCSV(text)
    } catch (e) { setError('Fetch failed: ' + e.message) }
  }

  function loadSample(sample) {
    loadData(
      sample.rows.map(r => Object.fromEntries(Object.entries(r).map(([k,v]) => [k, String(v)]))),
      `${sample.emoji} ${sample.name}`
    )
  }

  function goHome() {
    setPage('home')
    setView('explore')
  }

  function reset() {
    setRows([]); setColumns([]); setDataLoaded(false)
    setChartConfig(null); setChartData([])
    setQuery(''); setFollowUp(''); setError('')
    setDataLabel(''); setChartHistory([])
    setSuggestions([]); setChartView('chart')
    setRowWarning(false)
    localStorage.removeItem('datadropai_session')
  }

  // ── Query ──

  async function runQuery(q) {
    const question = q.trim()
    if (!question || !dataLoaded || rateLimitLeft > 0) return
    if (!rows.length) {
      setError('Re-upload your data to run new queries — raw data is not saved between sessions.')
      return
    }

    setLoading(true); setError(''); setChartConfig(null); setChartView('chart'); setSampledNotice(null)
    setLoadingMsg('Analyzing your data…')

    try {
      const systemPrompt = buildSystemPrompt(columns, rows)
      const messages = [{ role: 'system', content: systemPrompt }]
      if (chartConfig) {
        messages.push({ role: 'assistant', content: JSON.stringify(chartConfig) })
      }
      messages.push({ role: 'user', content: question })
      setLoadingMsg('Asking AI…')
      const raw = await queryLLM(messages, apiKey.trim())
      setLoadingMsg('Building chart…')

      let parsed
      try { parsed = JSON.parse(raw) }
      catch {
        const match = raw.match(/\{[\s\S]*\}/)
        if (!match) throw new Error('No JSON returned — try rephrasing.')
        parsed = JSON.parse(match[0])
      }

      if (!parsed.chartType || !parsed.xAxis) {
        throw new Error('Couldn\'t determine a chart. Try: "bar chart of sales by region"')
      }

      const config = normalizeConfig(parsed, columns)

      let sourceRows = rows
      if (config.filter?.column && Array.isArray(config.filter.values) && config.filter.values.length) {
        const col = config.filter.column
        const vals = new Set(config.filter.values.map(v => String(v).toLowerCase()))
        sourceRows = rows.filter(r => vals.has(String(r[col] ?? '').toLowerCase()))
        if (!sourceRows.length) sourceRows = rows
      }

      const processed = aggregateData(sourceRows, config, columns)
      if (!processed.length) throw new Error('Aggregation returned no data. Try different grouping.')

      const { data: chartSampled, sampled, total } = sampleForChart(processed, config.chartType)
      setSampledNotice(sampled ? { total, shown: chartSampled.length } : null)

      setChartConfig(config)
      setChartData(chartSampled)
      setChartId(prev => prev + 1)
      setChartHistory(prev => [{ config, data: processed, columns, query: question }, ...prev].slice(0, 12))
    } catch (e) {
      if (e.status === 429 || e.message?.toLowerCase().includes('rate limit')) {
        setRateLimitEnd(Date.now() + 60_000)
      } else {
        setError(e.message || 'Something went wrong generating the chart.')
      }
    } finally {
      setLoading(false)
      setLoadingMsg('')
    }
  }

  function restoreHistory(item) {
    setChartConfig(item.config)
    setChartData(item.data)
    setQuery(item.query)
    setChartView('chart')
    setChartId(prev => prev + 1)
  }

  function pinChart() {
    if (!chartConfig) return
    setPins(prev => [{ config: chartConfig, data: chartData, columns, query }, ...prev])
    addToast('Chart pinned to dashboard')
  }

  function unpinChart(i) {
    setPins(prev => prev.filter((_, idx) => idx !== i))
  }

  function isPinned() {
    return pins.some(p => p.config.title === chartConfig?.title)
  }

  async function shareChart() {
    if (!chartConfig) return
    const payload = encodeShare({ config: chartConfig, data: chartData.slice(0, 150), columns })
    if (!payload) return
    const url = `${location.origin}${location.pathname}?c=${payload}`
    await navigator.clipboard.writeText(url).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    addToast('Chart link copied to clipboard')
  }

  async function shareDashboard() {
    if (!pins.length) return
    const payload = encodeShare({
      pins: pins.slice(0, 8).map(p => ({ ...p, data: p.data?.slice(0, 200) })),
    })
    if (!payload) return
    const url = `${location.origin}${location.pathname}?d=${payload}`
    await navigator.clipboard.writeText(url).catch(() => {})
    setDashCopied(true)
    setTimeout(() => setDashCopied(false), 2500)
    addToast('Dashboard link copied to clipboard')
  }

  async function exportPNG() {
    if (!chartRef.current) return
    try {
      const bg = theme === 'light' ? '#ffffff' : '#0d0d0d'
      const canvas = await html2canvas(chartRef.current, { backgroundColor: bg, scale: 2, logging: false, useCORS: true })
      if (watermark) {
        const ctx = canvas.getContext('2d')
        ctx.font = '22px Inter, system-ui, sans-serif'
        ctx.fillStyle = theme === 'light' ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.12)'
        ctx.textAlign = 'right'
        ctx.fillText('Built with DataDropAI', canvas.width - 16, canvas.height - 12)
      }
      const link = document.createElement('a')
      link.download = `datadropai-${Date.now()}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      addToast('PNG exported')
    } catch { addToast('Export failed', 'error') }
  }

  function exportCSV() {
    if (!chartData.length) return
    const cols = Object.keys(chartData[0]).filter(k => !k.startsWith('_'))
    const csvRows = chartData.map(row =>
      cols.map(c => {
        const v = String(row[c] ?? '')
        return v.includes(',') || v.includes('"') || v.includes('\n')
          ? `"${v.replace(/"/g, '""')}"` : v
      }).join(',')
    )
    const blob = new Blob([[cols.join(','), ...csvRows].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `datadropai-${Date.now()}.csv`; a.click()
    URL.revokeObjectURL(url)
    addToast('CSV exported')
  }

  function copyDataJSON() {
    if (!chartData.length) return
    const cols = Object.keys(chartData[0]).filter(k => !k.startsWith('_'))
    const clean = chartData.map(row => Object.fromEntries(cols.map(c => [c, row[c]])))
    navigator.clipboard.writeText(JSON.stringify(clean, null, 2)).catch(() => {})
    addToast('Data copied as JSON')
  }

  function switchChartType(newType) {
    if (!chartConfig || chartConfig.chartType === newType) return
    const yAxes = Array.isArray(chartConfig.yAxis) ? chartConfig.yAxis : [chartConfig.yAxis].filter(Boolean)
    let newConfig = { ...chartConfig, chartType: newType }
    if (['pie', 'donut'].includes(newType) && yAxes.length > 1) {
      newConfig = { ...newConfig, yAxis: yAxes[0] }
    }
    if (newType === 'composed' && yAxes.length < 2) {
      const numCols = columns.filter(c => c.type === 'numeric' && c.name !== chartConfig.xAxis)
      if (numCols.length >= 2) newConfig = { ...newConfig, yAxis: [numCols[0].name, numCols[1].name] }
    }
    if (['scatter', 'bubble'].includes(newType)) {
      const numCols = columns.filter(c => c.type === 'numeric')
      if (numCols.length >= 2) {
        newConfig = {
          ...newConfig,
          xAxis: numCols[0].name,
          yAxis: newType === 'bubble' ? [numCols[1].name, numCols[2]?.name || numCols[1].name] : numCols[1].name,
          aggregation: 'none',
          groupBy: null,
        }
      }
    }
    setChartConfig(newConfig)
    setChartId(prev => prev + 1)
    setShowAvgLine(false)
  }

  // ── Landing page ──

  if (page === 'home') {
    return (
      <LandingPage
        onGetStarted={() => setPage('app')}
        onSample={loadSample}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    )
  }

  // ── App shell ──

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--t1)] antialiased">

      {/* Toast stack */}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2 pointer-events-none">
          {toasts.map(t => (
            <div key={t.id}
              className="flex items-center gap-2.5 bg-[var(--sf)] border border-[var(--ln2)] rounded-xl px-4 py-3 shadow-2xl text-[13px] text-[var(--t1)] animate-[toast-in_0.2s_ease]">
              <span className={t.type === 'error' ? 'text-red-400' : 'text-[#6366f1]'}>
                {t.type === 'error' ? '✕' : '✓'}
              </span>
              {t.message}
            </div>
          ))}
        </div>
      )}

      {/* Fullscreen overlay */}
      {fullscreen && chartConfig && (
        <div className="fixed inset-0 z-50 bg-[var(--bg)] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--ln)]">
            <div>
              <h2 className="text-[15px] font-semibold text-[var(--t1)]">{chartConfig.title}</h2>
              <span className="text-[10px] bg-[#6366f1]/10 text-[var(--afg)] px-2 py-0.5 rounded-md mt-1 inline-block font-medium uppercase tracking-wide">
                {CHART_LABEL[chartConfig.chartType] || chartConfig.chartType}
              </span>
            </div>
            <button onClick={() => setFullscreen(false)}
              className="text-[var(--t3)] hover:text-[var(--t1)] transition-colors w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[var(--sf2)] text-lg">
              ✕
            </button>
          </div>
          <div className="flex-1 px-6 py-4 min-h-0">
            <ChartErrorBoundary key={`fs-${chartId}`}>
              <ChartRenderer config={chartConfig} data={chartData} columns={columns}
                height={typeof window !== 'undefined' ? window.innerHeight - 160 : 500}
                colors={activeColors} />
            </ChartErrorBoundary>
          </div>
          <p className="text-center text-[11px] text-[var(--t5)] pb-3">Press Esc to exit</p>
        </div>
      )}

      {/* Header */}
      <header
        className="sticky top-0 z-20 border-b border-[var(--ln)] backdrop-blur-sm"
        style={{ backgroundColor: 'var(--nav-blur)' }}
      >
        <div className="max-w-5xl mx-auto px-6 h-12 flex items-center justify-between gap-4">

          <div className="flex items-center gap-1">
            <button
              onClick={goHome}
              className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-[var(--sf2)] transition-colors"
            >
              <Logo size={18} />
              <span className="text-[14px] font-semibold tracking-tight">DataDropAI</span>
            </button>

            {dataLoaded && (
              <>
                <span className="text-[var(--ln3)] text-lg leading-none mx-0.5">/</span>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => setView('explore')}
                    className={`text-[12px] px-2.5 py-1 rounded-lg transition-colors ${
                      view === 'explore'
                        ? 'bg-[var(--sf2)] text-[var(--t2)]'
                        : 'text-[var(--t4)] hover:text-[var(--t2)]'
                    }`}
                  >
                    Explore
                  </button>
                  <button
                    onClick={() => setView('dashboard')}
                    className={`text-[12px] px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1.5 ${
                      view === 'dashboard'
                        ? 'bg-[var(--sf2)] text-[var(--t2)]'
                        : 'text-[var(--t4)] hover:text-[var(--t2)]'
                    }`}
                  >
                    Dashboard
                    {pins.length > 0 && (
                      <span className="bg-[#6366f1] text-white text-[9px] px-1.5 py-0.5 rounded-full leading-none font-medium">
                        {pins.length}
                      </span>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {dataLoaded && (
              <span className="text-[11px] text-[var(--t5)] hidden sm:block max-w-[140px] truncate">{dataLabel}</span>
            )}
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <input
              type="password"
              placeholder="Groq API key (optional)"
              value={apiKey}
              onChange={e => { setApiKey(e.target.value); localStorage.setItem('datadropai_key', e.target.value) }}
              className="text-[11px] bg-[var(--sf)] border border-[var(--ln)] rounded-lg px-3 py-1.5 text-[var(--t3)] w-44 focus:outline-none focus:border-[#6366f1]/50 placeholder:text-[var(--t5)] transition-colors"
            />
          </div>
        </div>
      </header>

      {/* Dashboard view */}
      {view === 'dashboard' && (
        <Dashboard
          pins={pins}
          onUnpin={unpinChart}
          onClose={() => setView('explore')}
          colors={activeColors}
          theme={theme}
          onShare={shareDashboard}
          dashCopied={dashCopied}
        />
      )}

      {/* Explore view */}
      {view === 'explore' && (
        <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">

          {!dataLoaded ? (
            <div className="space-y-6">
              <div className="text-center pt-2">
                <h1 className="text-[22px] font-semibold tracking-tight mb-1.5">Load your data</h1>
                <p className="text-[var(--t4)] text-sm">Upload a file, paste data, or start with a sample.</p>
              </div>
              {parseLoading ? (
                <div className="flex flex-col items-center gap-3 py-16 text-[var(--t4)]">
                  <svg className="animate-spin w-6 h-6 text-[#6366f1]" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                  </svg>
                  <p className="text-sm">Parsing file…</p>
                </div>
              ) : (
                <DataInput onCSV={loadCSV} onJSON={loadJSON} onURL={loadURL} onSample={loadSample} onFile={loadCSVFile} onFiles={loadCSVFiles} />
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="bg-[var(--sf)] border border-[var(--ln)] rounded-xl overflow-hidden">
                <button
                  onClick={() => setPreviewOpen(o => !o)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-[12px] text-[var(--t4)] hover:text-[var(--t2)] transition-colors group"
                >
                  <span className="flex items-center gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#6366f1] shrink-0" />
                    <span className="text-[var(--t2)] font-medium">{dataLabel}</span>
                    <span className="text-[var(--t5)]">·</span>
                    <span>{rows.length.toLocaleString()} rows · {columns.length} columns</span>
                    <span className="text-[var(--t5)] hidden sm:block truncate max-w-[260px]">
                      · {columns.map(c => c.name).join(', ')}
                    </span>
                  </span>
                  <span className="text-[var(--t5)] group-hover:text-[var(--t3)] transition-colors text-[10px]">
                    {previewOpen ? '▲' : '▼'}
                  </span>
                </button>
                <div style={{ maxHeight: previewOpen ? 200 : 0, overflow: 'hidden', transition: 'max-height 0.2s ease' }}>
                  <div className="overflow-x-auto border-t border-[var(--ln)]">
                    <table className="text-[11px] text-left w-full">
                      <thead>
                        <tr>
                          {columns.map(c => (
                            <th key={c.name} className="px-3 py-2 text-[var(--t3)] font-medium whitespace-nowrap border-b border-[var(--ln)]">
                              {c.name}
                              <span className="ml-1 text-[#6366f1]/40 text-[9px]">{c.type[0]}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 5).map((row, i) => (
                          <tr key={i} className="border-b border-[var(--ln)] hover:bg-[var(--sf2)] transition-colors">
                            {columns.map(c => (
                              <td key={c.name} className="px-3 py-2 text-[var(--t3)] whitespace-nowrap max-w-[180px] truncate">
                                {row[c.name]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              {!rows.length && (
                <p className="text-[11px] text-amber-400/80 pl-1 flex items-center gap-1.5">
                  <span>⚠</span> Re-upload your file to run new queries — raw data is never stored between sessions.
                </p>
              )}
              <button onClick={reset}
                className="text-[11px] text-[var(--t5)] hover:text-[var(--t3)] transition-colors pl-1">
                ← Load different data
              </button>
            </div>
          )}

          {/* Row limit warning */}
          {rowWarning && (
            <div className="flex items-center justify-between bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3">
              <p className="text-[12px] text-amber-400/90">
                <span className="font-medium">Large dataset:</span> {rows.length.toLocaleString()} rows loaded — queries may be slower.
              </p>
              <button onClick={() => setRowWarning(false)}
                className="text-amber-400/50 hover:text-amber-400 ml-4 transition-colors text-[11px]">✕</button>
            </div>
          )}

          {/* Column stats strip */}
          {dataLoaded && <StatsStrip rows={rows} columns={columns} />}

          {/* Rate limit banner */}
          {rateLimitLeft > 0 && (
            <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[13px] text-amber-400 font-medium">Rate limit reached</p>
                <span className="text-[12px] text-amber-400/70 tabular-nums">{rateLimitLeft}s</span>
              </div>
              <div className="h-1 bg-amber-500/15 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400/60 rounded-full transition-all duration-250"
                  style={{ width: `${(rateLimitLeft / 60) * 100}%` }}
                />
              </div>
              <p className="text-[11px] text-amber-400/60">
                Retry in {rateLimitLeft}s, or add your own Groq API key above to bypass limits.
              </p>
            </div>
          )}

          {/* Query bar */}
          {dataLoaded && (
            <div className="space-y-2.5">
              <div className="relative">
                <input
                  ref={queryInputRef}
                  type="text"
                  placeholder='Ask a question, e.g. "bar chart of sales by country"'
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !rateLimitLeft && runQuery(query)}
                  className="w-full bg-[var(--sf)] border border-[var(--ln2)] focus:border-[#6366f1]/60 rounded-xl px-5 py-4 text-[14px] text-[var(--t1)] placeholder:text-[var(--t5)] focus:outline-none transition-colors pr-24"
                />
                {query && !loading && (
                  <button onClick={() => setQuery('')}
                    className="absolute right-[4.5rem] top-1/2 -translate-y-1/2 text-[var(--t4)] hover:text-[var(--t2)] transition-colors p-1">
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  </button>
                )}
                <button
                  onClick={() => runQuery(query)}
                  disabled={loading || !query.trim() || rateLimitLeft > 0}
                  title={rateLimitLeft > 0 ? `Rate limited — ${rateLimitLeft}s remaining` : undefined}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#6366f1] hover:bg-[#5254cc] disabled:opacity-25 disabled:cursor-not-allowed text-white text-[12px] font-medium px-4 py-1.5 rounded-lg transition-colors"
                >
                  {loading ? '···' : 'Ask'}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 items-center">
                {suggestionsLoading && !suggestions.length
                  ? CHIPS.map(chip => (
                      <div key={chip}
                        className="h-6 rounded-full bg-[var(--sf)] border border-[var(--ln)] animate-pulse"
                        style={{ width: `${chip.length * 7 + 24}px` }} />
                    ))
                  : (suggestions.length ? suggestions : CHIPS).map(chip => (
                      <button key={chip} onClick={() => { setQuery(chip); runQuery(chip) }}
                        className="text-[11px] bg-[var(--sf)] border border-[var(--ln)] hover:border-[var(--ln3)] text-[var(--t4)] hover:text-[var(--t2)] px-3 py-1 rounded-full transition-colors">
                        {chip}
                      </button>
                    ))
                }
                <span className="text-[10px] text-[var(--t5)] ml-auto hidden sm:block">⌘K to focus</span>
              </div>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="space-y-3">
              {loadingMsg && (
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6366f1] animate-pulse" />
                  <span className="text-[12px] text-[var(--t3)]">{loadingMsg}</span>
                </div>
              )}
              <div className="animate-pulse space-y-3">
                <div className="h-3.5 bg-[var(--sf2)] rounded w-40" />
                <div className="h-[360px] bg-[var(--sf)] rounded-2xl border border-[var(--ln)]" />
                <div className="h-3 bg-[var(--sf2)] rounded w-64" />
              </div>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="bg-[var(--err-bg)] border border-[var(--err-br)] rounded-xl px-5 py-4 text-[13px] text-[var(--err-fg)] leading-relaxed">
              {error}
            </div>
          )}

          {/* Chart card */}
          {chartConfig && !loading && (
            <div ref={chartRef} className="bg-[var(--sf)] border border-[var(--ln)] rounded-2xl p-6 space-y-5 chart-fade-in">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-[15px] font-semibold text-[var(--t1)] leading-snug">{chartConfig.title}</h2>
                  <span className="text-[10px] bg-[#6366f1]/10 text-[var(--afg)] px-2 py-0.5 rounded-md mt-1.5 inline-block font-medium tracking-wide uppercase">
                    {CHART_LABEL[chartConfig.chartType] || chartConfig.chartType}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                  {/* Chart / Table toggle */}
                  <div className="flex items-center bg-[var(--sf2)] border border-[var(--ln2)] rounded-lg p-0.5 mr-1">
                    {['chart', 'table'].map(v => (
                      <button key={v} onClick={() => setChartView(v)}
                        className={`text-[11px] px-2.5 py-1 rounded-md transition-colors capitalize ${
                          chartView === v
                            ? 'bg-[var(--sf)] text-[var(--t1)] shadow-sm'
                            : 'text-[var(--t4)] hover:text-[var(--t2)]'
                        }`}>
                        {v}
                      </button>
                    ))}
                  </div>
                  {/* Fullscreen */}
                  <button onClick={() => setFullscreen(true)} title="Fullscreen"
                    className="flex items-center justify-center w-7 h-7 bg-[var(--sf2)] border border-[var(--ln2)] hover:border-[var(--ln3)] text-[var(--t3)] hover:text-[var(--t1)] rounded-lg transition-colors">
                    <FullscreenIcon />
                  </button>
                  {/* Palette */}
                  <PalettePicker palette={palette} onPalette={setPalette} />
                  {/* Regenerate */}
                  <button onClick={() => runQuery(query)} disabled={loading || !query.trim() || !rows.length}
                    title="Re-run this query"
                    className="text-[11px] bg-[var(--sf2)] border border-[var(--ln2)] hover:border-[var(--ln3)] disabled:opacity-30 disabled:cursor-not-allowed text-[var(--t3)] hover:text-[var(--t1)] px-2.5 py-1.5 rounded-lg transition-colors">
                    ↻
                  </button>
                  {/* Share */}
                  <button onClick={shareChart}
                    className="text-[11px] bg-[var(--sf2)] border border-[var(--ln2)] hover:border-[var(--ln3)] text-[var(--t3)] hover:text-[var(--t1)] px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                    {copied ? '✓ Copied' : 'Share'}
                  </button>
                  {/* Pin */}
                  <button onClick={pinChart} disabled={isPinned()}
                    className={`text-[11px] border px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                      isPinned()
                        ? 'bg-[#6366f1]/8 border-[#6366f1]/20 text-[var(--afg)] cursor-default'
                        : 'bg-[var(--sf2)] border-[var(--ln2)] hover:border-[#6366f1]/40 text-[var(--t3)] hover:text-[var(--t1)]'
                    }`}>
                    {isPinned() ? 'Pinned' : 'Pin'}
                  </button>
                  {/* Export dropdown */}
                  <div className="relative" ref={exportMenuRef}>
                    <button onClick={() => setExportOpen(o => !o)}
                      className="flex items-center gap-1 text-[11px] bg-[var(--sf2)] border border-[var(--ln2)] hover:border-[var(--ln3)] text-[var(--t3)] hover:text-[var(--t1)] px-3 py-1.5 rounded-lg transition-colors">
                      Export
                      <span className="text-[9px] opacity-60">▾</span>
                    </button>
                    {exportOpen && (
                      <div className="absolute right-0 top-full mt-1 bg-[var(--sf)] border border-[var(--ln2)] rounded-xl shadow-xl z-40 py-1.5 min-w-[148px]">
                        <button onClick={() => { exportPNG(); setExportOpen(false) }}
                          className="w-full px-3.5 py-2 text-[12px] text-left text-[var(--t3)] hover:text-[var(--t1)] hover:bg-[var(--sf2)] transition-colors">
                          PNG image
                        </button>
                        <button onClick={() => { exportCSV(); setExportOpen(false) }}
                          className="w-full px-3.5 py-2 text-[12px] text-left text-[var(--t3)] hover:text-[var(--t1)] hover:bg-[var(--sf2)] transition-colors">
                          CSV data
                        </button>
                        <button onClick={() => { copyDataJSON(); setExportOpen(false) }}
                          className="w-full px-3.5 py-2 text-[12px] text-left text-[var(--t3)] hover:text-[var(--t1)] hover:bg-[var(--sf2)] transition-colors">
                          Copy as JSON
                        </button>
                        <div className="border-t border-[var(--ln)] my-1" />
                        <label className="flex items-center gap-2 px-3.5 py-1.5 cursor-pointer group">
                          <input type="checkbox" checked={watermark} onChange={e => setWatermark(e.target.checked)}
                            className="accent-[#6366f1] cursor-pointer" />
                          <span className="text-[11px] text-[var(--t4)] group-hover:text-[var(--t3)] transition-colors">Watermark</span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Chart type switcher strip */}
              <div className="flex items-center gap-2">
                <div className="flex gap-1 overflow-x-auto flex-1" style={{ scrollbarWidth: 'none' }}>
                  {Object.entries(CHART_LABEL).map(([type, label]) => (
                    <button key={type} onClick={() => switchChartType(type)}
                      className={`shrink-0 text-[10px] font-medium px-2.5 py-1 rounded-md border transition-all ${
                        chartConfig.chartType === type
                          ? 'bg-[#6366f1]/12 border-[#6366f1]/25 text-[var(--afg)]'
                          : 'border-[var(--ln)] text-[var(--t4)] hover:text-[var(--t2)] hover:border-[var(--ln3)]'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
                {['bar', 'line', 'area', 'composed'].includes(chartConfig.chartType) && (
                  <button onClick={() => setShowAvgLine(v => !v)}
                    title="Toggle average reference line"
                    className={`shrink-0 text-[10px] font-medium px-2.5 py-1 rounded-md border transition-all ${
                      showAvgLine
                        ? 'bg-[#6366f1]/12 border-[#6366f1]/25 text-[var(--afg)]'
                        : 'border-[var(--ln)] text-[var(--t4)] hover:text-[var(--t2)] hover:border-[var(--ln3)]'
                    }`}>
                    Avg
                  </button>
                )}
                <span className="text-[10px] text-[var(--t5)] shrink-0 ml-1">
                  {chartData.length} pts
                </span>
              </div>

              {sampledNotice && (
                <div className="text-[11px] text-[var(--t4)] bg-[var(--sf2)] border border-[var(--ln)] rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                  <span className="text-[var(--afg)]">↓</span>
                  Showing {sampledNotice.shown.toLocaleString()} sampled from {sampledNotice.total.toLocaleString()} aggregated points
                </div>
              )}

              {chartView === 'chart'
                ? (
                  <ChartErrorBoundary key={chartId}>
                    <ChartRenderer config={chartConfig} data={chartData} columns={columns} colors={activeColors} showAvgLine={showAvgLine} />
                  </ChartErrorBoundary>
                )
                : <DataTable data={chartData} />
              }

              {chartConfig.insight && (
                <div className="border-t border-[var(--ln)] pt-4">
                  <div className="flex gap-2.5 bg-[#6366f1]/4 border border-[#6366f1]/10 rounded-xl px-3.5 py-3">
                    <span className="text-[var(--afg)] text-[13px] mt-0.5 shrink-0">↳</span>
                    <p className="text-[12px] text-[var(--t2)] leading-relaxed">{chartConfig.insight}</p>
                  </div>
                </div>
              )}

              <div className="border-t border-[var(--ln)] pt-4 space-y-2.5">
                {/* Smart follow-up chips */}
                <div className="flex flex-wrap gap-1.5">
                  {getFollowUps(chartConfig, columns).map(q => (
                    <button key={q}
                      onClick={() => { setFollowUp(q); runQuery(q) }}
                      className="text-[11px] bg-[#6366f1]/5 border border-[#6366f1]/15 hover:border-[#6366f1]/35 text-[var(--afg)] hover:bg-[#6366f1]/10 px-3 py-1 rounded-full transition-colors">
                      {q}
                    </button>
                  ))}
                </div>
                {/* Free-form refine */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Or type a refinement…"
                    value={followUp}
                    onChange={e => setFollowUp(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && followUp.trim()) { runQuery(followUp); setFollowUp('') } }}
                    className="flex-1 bg-[var(--bg)] border border-[var(--ln2)] focus:border-[#6366f1]/40 rounded-xl px-4 py-2.5 text-[13px] text-[var(--t1)] placeholder:text-[var(--t5)] focus:outline-none transition-colors"
                  />
                  <button
                    onClick={() => { if (followUp.trim()) { runQuery(followUp); setFollowUp('') } }}
                    disabled={!followUp.trim()}
                    className="text-[12px] bg-[var(--bg)] border border-[var(--ln2)] hover:border-[var(--ln3)] disabled:opacity-30 text-[var(--t3)] hover:text-[var(--t1)] px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap"
                  >
                    Refine
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* History strip */}
          {dataLoaded && (
            <HistoryStrip chartHistory={chartHistory} onRestore={restoreHistory} />
          )}

        </main>
      )}
    </div>
  )
}
