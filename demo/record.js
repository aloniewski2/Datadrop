/**
 * DataDropAI — Demo Screen Recording
 * Run:  node demo/record.js
 * Requires: npm run dev running in another terminal (localhost:5173)
 * Output:   demo/output/datadropai-demo.webm
 *
 * Convert to MP4:
 *   ffmpeg -i demo/output/datadropai-demo.webm -c:v libx264 -crf 18 demo/output/datadropai-demo.mp4
 */

import { chromium } from 'playwright'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR   = path.join(__dirname, 'output')
fs.mkdirSync(OUT_DIR, { recursive: true })

// ── Mocked AI responses ────────────────────────────────────────────────────────

const SUGGESTIONS = JSON.stringify({
  suggestions: [
    'How has our monthly revenue grown?',
    'Which month had the highest churn rate?',
    'How do user signups track over time?',
    'What does our NPS trend look like?',
    'When did our growth accelerate most?',
  ],
})

const CHARTS = [
  // Q1 → area chart, MRR growth
  JSON.stringify({
    chartType: 'area',
    title: 'Monthly Revenue Growth',
    xAxis: 'month',
    yAxis: 'mrr',
    groupBy: null,
    aggregation: 'none',
    colorBy: null,
    filter: null,
    insight: 'Revenue grew 333% — from $12K in January to $52K in December — with the steepest climb in Q4.',
  }),
  // Q2 → bar chart, churn by month
  JSON.stringify({
    chartType: 'bar',
    title: 'Monthly Churn Rate',
    xAxis: 'month',
    yAxis: 'churn',
    groupBy: null,
    aggregation: 'none',
    colorBy: null,
    filter: null,
    insight: 'Churn peaked at 2.3% in March and fell to just 1% by December, signalling strong product improvements.',
  }),
  // Q3 → composed chart, MRR bars + users line overlay
  JSON.stringify({
    chartType: 'composed',
    title: 'Revenue vs User Growth',
    xAxis: 'month',
    yAxis: ['mrr', 'users'],
    groupBy: null,
    aggregation: 'none',
    colorBy: null,
    filter: null,
    insight: 'User growth and revenue track closely — every 100 new users added roughly $2K MRR, consistent with a healthy $20 ARPU expansion.',
  }),
]

// ── Helpers ────────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function typeSlowly(locator, text, delayMs = 55) {
  await locator.click()
  for (const char of text) {
    await locator.type(char)
    await sleep(delayMs + Math.random() * 30)
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

;(async () => {
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  })

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: {
      dir: OUT_DIR,
      size: { width: 1280, height: 800 },
    },
  })

  await context.addInitScript(() => {
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('datadropai')) localStorage.removeItem(k)
    })
  })

  const page = await context.newPage()

  // ── Mock the AI endpoint ───────────────────────────────────────────────────
  let callCount = 0
  await page.route('**/api/query', async route => {
    await sleep(900)
    const idx = callCount++
    const content = idx === 0 ? SUGGESTIONS : CHARTS[Math.min(idx - 1, CHARTS.length - 1)]
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content }),
    })
  })

  // ── 1. Landing page ────────────────────────────────────────────────────────
  console.log('[1] Landing page…')
  await page.goto('http://localhost:5173')
  await page.waitForLoadState('networkidle')
  await sleep(2000)

  // ── 2. Load sample dataset ─────────────────────────────────────────────────
  console.log('[2] Loading sample data…')
  await page.click('button:has-text("Try a demo")')

  const queryInput = page.locator('input[placeholder*="Ask a question"]')
  await queryInput.waitFor({ timeout: 8000 })
  await sleep(800)

  // ── 3. Wait for AI suggestions ─────────────────────────────────────────────
  console.log('[3] Waiting for suggestions…')
  await page.locator('button:has-text("How has our monthly revenue grown?")').waitFor({ timeout: 12000 })
  await sleep(1200)

  // ── 4. Query 1: area chart ─────────────────────────────────────────────────
  console.log('[4] Query 1: revenue…')
  await page.click('button:has-text("How has our monthly revenue grown?")')
  await page.locator('.recharts-responsive-container').waitFor({ timeout: 10000 })
  await sleep(3000)

  await page.locator('button:has-text("Pin"):not([disabled])').first().click()
  await sleep(800)

  // ── 5. Query 2: bar chart ──────────────────────────────────────────────────
  console.log('[5] Query 2: churn…')
  await queryInput.fill('')
  await sleep(300)
  await typeSlowly(queryInput, 'Which month had the highest churn rate?')
  await sleep(600)
  await queryInput.press('Enter')
  await page.locator('.recharts-responsive-container').waitFor({ timeout: 10000 })
  await sleep(3000)

  await page.locator('button:has-text("Pin"):not([disabled])').first().click()
  await sleep(800)

  // ── 6. Query 3: composed chart ─────────────────────────────────────────────
  console.log('[6] Query 3: revenue vs users…')
  await queryInput.fill('')
  await sleep(300)
  await typeSlowly(queryInput, 'How do revenue and user growth compare?')
  await sleep(600)
  await queryInput.press('Enter')
  await page.locator('.recharts-responsive-container').waitFor({ timeout: 10000 })
  await sleep(3000)

  // ── 7. Switch to Dashboard ─────────────────────────────────────────────────
  console.log('[7] Dashboard…')
  await page.click('button:has-text("Dashboard")')
  await sleep(3500)

  // ── Done ───────────────────────────────────────────────────────────────────
  console.log('Closing…')
  await context.close()
  await browser.close()

  const files = fs.readdirSync(OUT_DIR)
    .filter(f => f.endsWith('.webm'))
    .map(f => ({ f, t: fs.statSync(path.join(OUT_DIR, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)

  if (files.length) {
    const dest = path.join(OUT_DIR, 'datadropai-demo.webm')
    if (files[0].f !== 'datadropai-demo.webm') {
      fs.renameSync(path.join(OUT_DIR, files[0].f), dest)
    }
    console.log('\n✓  Saved: demo/output/datadropai-demo.webm')
    console.log('   ffmpeg -i demo/output/datadropai-demo.webm -c:v libx264 -crf 18 demo/output/datadropai-demo.mp4')
  }
})()
