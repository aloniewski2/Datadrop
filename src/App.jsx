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
  FunnelChart, Funnel,
  XAxis, YAxis, ZAxis,
  CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
  LabelList,
} from 'recharts'
import * as d3 from 'd3'
import html2canvas from 'html2canvas'
import * as XLSX from 'xlsx'

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
  backgroundColor: 'var(--sf3)',
  border: '1px solid var(--ln2)',
  borderRadius: '10px',
  color: 'var(--t1)',
  fontSize: '12px',
  padding: '8px 12px',
  boxShadow: 'var(--shadow-md)',
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
  bubble: 'Bubble', pie: 'Pie', donut: 'Donut', heatmap: 'Heatmap', composed: 'Composed', funnel: 'Funnel',
}

// Max data points rendered per chart type — keeps Recharts from crashing on huge datasets
const CHART_MAX_PTS = {
  bar: 200, line: 2000, area: 2000, scatter: 8000,
  bubble: 4000, pie: 60, donut: 60, heatmap: 3000, composed: 2000, funnel: 200,
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
    sortBy: cfg.sortBy || 'none',
    sortOrder: cfg.sortOrder || 'desc',
    limit: (typeof cfg.limit === 'number' && cfg.limit > 0) ? cfg.limit : null,
  }
}

// Period-over-period trend: compares last ~20% of rows vs prior ~20% on each numeric column.
// Requires a date-type column to sort by. Returns null if not enough data.
function computeTrends(rows, columns) {
  const dateCol = columns.find(c => c.type === 'date')
  if (!dateCol || rows.length < 4) return null
  const numCols = columns.filter(c => c.type === 'numeric').slice(0, 5)
  if (!numCols.length) return null
  const sorted = [...rows].sort((a, b) =>
    String(a[dateCol.name]).localeCompare(String(b[dateCol.name]))
  )
  const n = Math.max(1, Math.floor(sorted.length * 0.2))
  const recent = sorted.slice(-n)
  const prior  = sorted.slice(-2 * n, -n)
  if (!prior.length) return null
  const mean = (arr, col) => {
    const vals = arr.map(r => Number(r[col])).filter(v => !isNaN(v))
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }
  return numCols.map(c => {
    const r = mean(recent, c.name), p = mean(prior, c.name)
    if (r === null || p === null || p === 0) return null
    return { col: c.name, pct: ((r - p) / Math.abs(p)) * 100, recent: r, prior: p }
  }).filter(Boolean)
}

// Natural-language row filter: "sales > 1000 and region = West"
function applyRowFilter(rows, expr) {
  if (!expr.trim()) return rows
  const OPS = {
    '>=': (a, b) => Number(a) >= Number(b),
    '<=': (a, b) => Number(a) <= Number(b),
    '!=': (a, b) => String(a).toLowerCase() !== String(b).toLowerCase(),
    '>':  (a, b) => Number(a) > Number(b),
    '<':  (a, b) => Number(a) < Number(b),
    '=':  (a, b) => String(a).toLowerCase() === String(b).toLowerCase(),
    'contains': (a, b) => String(a).toLowerCase().includes(String(b).toLowerCase()),
  }
  const RE = /^(.+?)\s*(>=|<=|!=|contains|>|<|=)\s*(.+)$/i
  function evalCond(cond, row) {
    const m = cond.trim().match(RE)
    if (!m) return true
    const [, col, op, raw] = m
    const key = Object.keys(row).find(k => k.toLowerCase() === col.trim().toLowerCase()) ?? col.trim()
    const val = raw.trim().replace(/^["']|["']$/g, '')
    return OPS[op.toLowerCase()]?.(row[key] ?? '', val) ?? true
  }
  try {
    return rows.filter(row =>
      expr.split(/\band\b/i).every(andPart =>
        andPart.split(/\bor\b/i).some(orPart => evalCond(orPart, row))
      )
    )
  } catch { return rows }
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

// Pick the best initial chart type based on column types alone — no AI needed
function pickInitialChart(columns) {
  const dateCol = columns.find(c => c.type === 'date')
  const numCol  = columns.find(c => c.type === 'numeric')
  const catCol  = columns.find(c => c.type === 'categorical')
  if (!numCol) return null
  const yLabel = numCol.name
  if (dateCol && catCol) {
    return {
      chartType: 'line', title: `${yLabel} over time by ${catCol.name}`,
      xAxis: dateCol.name, yAxis: yLabel, groupBy: catCol.name,
      aggregation: 'sum', sortBy: 'xAxis', sortOrder: 'asc', limit: null,
    }
  }
  if (dateCol) {
    return {
      chartType: 'area', title: `${yLabel} over time`,
      xAxis: dateCol.name, yAxis: yLabel,
      aggregation: 'sum', sortBy: 'xAxis', sortOrder: 'asc', limit: null,
    }
  }
  if (catCol) {
    return {
      chartType: 'bar', title: `${yLabel} by ${catCol.name}`,
      xAxis: catCol.name, yAxis: yLabel,
      aggregation: 'sum', sortBy: 'yAxis', sortOrder: 'desc', limit: null,
    }
  }
  return {
    chartType: 'bar', title: `${yLabel} overview`,
    xAxis: columns[0].name, yAxis: yLabel,
    aggregation: 'none', sortBy: 'none', sortOrder: 'desc', limit: null,
  }
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
  const sample = rows.slice(0, 8).map(r => JSON.stringify(r)).join('\n')
  return `You are a data visualization expert. Return ONLY a valid JSON object — no markdown, no explanation.

JSON schema:
{
  "answerType": "chart"|"insight",
  "chartType": "bar"|"line"|"area"|"scatter"|"bubble"|"pie"|"donut"|"heatmap"|"composed"|"funnel",
  "title": "concise descriptive title",
  "xAxis": "exact column name",
  "yAxis": "exact column name OR array of column names",
  "groupBy": "exact column name or null",
  "aggregation": "sum"|"avg"|"count"|"none",
  "colorBy": "exact column name or null",
  "filter": {"column": "exact column name", "values": ["value1", "value2"]} or null,
  "sortBy": "xAxis"|"yAxis"|"none",
  "sortOrder": "asc"|"desc",
  "limit": null or integer (top N rows after sort),
  "insight": "one sentence plain-English insight",
  "answer": "plain-English answer if answerType is insight"
}

Rules:
- Use EXACT column names from the dataset
- answerType="insight" for questions that don't need a chart (e.g. "what is the total?", "which has the highest?")
- answerType="chart" for all visualization requests
- bar/line/area: xAxis = category or date, yAxis = numeric col(s)
- scatter: xAxis & yAxis = two numeric cols, aggregation = "none"
- bubble: xAxis = numeric, yAxis = [y_col, size_col], aggregation = "none"
- pie/donut: xAxis = category, yAxis = single numeric col
- heatmap: xAxis = first categorical, yAxis = second categorical
- composed: yAxis = array; first → bars, rest → lines
- funnel: xAxis = stage/category col, yAxis = single numeric col (shows conversion stages)
- groupBy creates grouped/multi-series charts
- Prefer date cols on xAxis for trend queries
- Use filter when the user specifies particular items (e.g. "compare USA and China", "only Q1 and Q2")
- Use sortBy + limit for "top N" queries (e.g. "top 10 products" → sortBy="yAxis", sortOrder="desc", limit=10)
- Use sortBy="xAxis" to sort alphabetically/chronologically

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
      max_tokens: 900,
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

// Streaming variant — calls onChunk(accumulatedText) for each SSE delta
async function streamQueryLLM(messages, userKey, onChunk) {
  const url = userKey
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : '/api/query'
  const body = userKey
    ? { model: 'llama-3.3-70b-versatile', messages, temperature: 0.1, max_tokens: 900, stream: true, response_format: { type: 'json_object' } }
    : { messages, stream: true }
  const headers = {
    'Content-Type': 'application/json',
    ...(userKey ? { Authorization: `Bearer ${userKey}` } : {}),
  }
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const err = new Error(data.error?.message || data.error || `Error ${res.status}`)
    err.status = res.status
    throw err
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let accumulated = ''
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() // keep incomplete line
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const raw = line.slice(6).trim()
      if (raw === '[DONE]') continue
      try {
        const delta = JSON.parse(raw).choices?.[0]?.delta?.content ?? ''
        if (delta) { accumulated += delta; onChunk(accumulated) }
      } catch {}
    }
  }
  return accumulated
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

async function generateDatasetProfile(columns, rows, userKey) {
  const schema = columns.map(c => `${c.name} (${c.type})`).join(', ')
  const sample = rows.slice(0, 6).map(r => JSON.stringify(r)).join('\n')
  const messages = [
    {
      role: 'system',
      content: 'You are a data analyst. Return ONLY valid JSON — no markdown, no explanation.',
    },
    {
      role: 'user',
      content: `Analyze this dataset and return a JSON object describing what it measures.

Schema: ${schema}
Sample rows:
${sample}

Return exactly: {"summary": "one sentence describing what this dataset tracks", "columns": [{"name": "exact col name", "role": "metric"|"dimension"|"id"|"date", "description": "brief description"}]}

role definitions:
- metric: a numeric measurement (sales, revenue, count, rate)
- dimension: a categorical grouping (country, category, name)
- id: a unique identifier
- date: a time/date column`,
    },
  ]
  const raw = await queryLLM(messages, userKey)
  return JSON.parse(raw)
}

async function explainChart(config, data, userKey, eli5 = false) {
  const sample = data.slice(0, 12).map(r => JSON.stringify(r)).join('\n')
  const instruction = eli5
    ? `Explain this chart like the reader is 5 years old. Use simple everyday words and a real-world analogy a child would understand. No numbers in percentage form — say "almost double" instead of "+97%". 2-3 sentences max.`
    : `Explain this chart to a non-technical person in 2-3 sentences. Focus on the key pattern, trend, or finding.`
  const messages = [
    { role: 'system', content: 'You are a data analyst. Return ONLY valid JSON.' },
    {
      role: 'user',
      content: `${instruction}

Chart title: ${config.title}
Chart type: ${config.chartType}
X axis: ${config.xAxis}, Y axis: ${Array.isArray(config.yAxis) ? config.yAxis.join(', ') : config.yAxis}
Data sample:
${sample}

Return: {"explanation": "your explanation"}`,
    },
  ]
  const raw = await queryLLM(messages, userKey)
  return JSON.parse(raw)
}

async function generateSmartOverview(columns, rows, userKey) {
  const schema = columns.map(c => `${c.name} (${c.type})`).join(', ')
  const sample = rows.slice(0, 10).map(r => JSON.stringify(r)).join('\n')
  const messages = [
    { role: 'system', content: 'You are a senior data analyst. Return ONLY valid JSON with no markdown.' },
    {
      role: 'user',
      content: `Analyze this dataset and return a smart overview.

Dataset columns: ${schema}
Sample rows:
${sample}

Return exactly this JSON:
{
  "headline": "One punchy sentence including a specific number, %, or multiplier. Lead with the strongest finding. Example: 'Electronics revenue is 2.3× higher than any other category.'",
  "insights": [
    "Key insight 1 — different angle from headline",
    "Key insight 2 — another metric or pattern",
    "Key insight 3 — trend, outlier, or comparison"
  ],
  "questions": [
    "Why is [X] the highest?",
    "What drives [Y] over time?",
    "How does [A] compare to [B]?"
  ]
}

Rules:
- headline: 1 sentence, must include at least one concrete number from the data
- insights: exactly 3, each a different angle (trend, comparison, distribution)
- questions: exactly 3 starting with Why/What/How — make them feel like a curious analyst wrote them
- Base all values on the actual sample data, not guesses`,
    },
  ]
  const raw = await queryLLM(messages, userKey)
  return JSON.parse(raw)
}

async function detectAnomalies(columns, rows, userKey) {
  const numCols = columns.filter(c => c.type === 'numeric').slice(0, 6)
  if (!numCols.length) return []
  const stats = numCols.map(col => {
    const vals = rows.map(r => Number(r[col.name])).filter(v => !isNaN(v))
    if (!vals.length) return null
    const sorted = [...vals].sort((a, b) => a - b)
    const q1 = sorted[Math.floor(sorted.length * 0.25)]
    const q3 = sorted[Math.floor(sorted.length * 0.75)]
    const iqr = q3 - q1
    const nullCount = rows.filter(r => r[col.name] === '' || r[col.name] === null || r[col.name] === undefined).length
    const negCount = vals.filter(v => v < 0).length
    return { col: col.name, min: sorted[0], max: sorted[sorted.length - 1], q1, q3, iqr, nullCount, negCount, total: rows.length }
  }).filter(Boolean)
  const messages = [
    { role: 'system', content: 'You are a data quality analyst. Return ONLY valid JSON.' },
    {
      role: 'user',
      content: `Review these column statistics and identify data quality issues (outliers, nulls, anomalies, suspicious values). Only flag real issues.

Stats: ${JSON.stringify(stats)}

Return: {"anomalies": [{"column": "col name", "issue": "short label", "detail": "one sentence detail", "severity": "high"|"medium"|"low"}]}
If no issues found, return: {"anomalies": []}`,
    },
  ]
  try {
    const raw = await queryLLM(messages, userKey)
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed.anomalies) ? parsed.anomalies : []
  } catch { return [] }
}

async function generateReport(columns, rows, userKey) {
  const schema = columns.map(c => `${c.name} (${c.type})`).join(', ')
  const sample = rows.slice(0, 6).map(r => JSON.stringify(r)).join('\n')
  const messages = [
    { role: 'system', content: 'You are a data visualization expert. Return ONLY valid JSON.' },
    {
      role: 'user',
      content: `Generate a 4-chart dashboard report for this dataset.

Schema: ${schema}
Sample rows:
${sample}

Return:
{
  "narrative": "2-3 sentence executive summary of key findings",
  "charts": [
    {"chartType": "bar"|"line"|"area"|"pie", "title": "...", "xAxis": "col", "yAxis": "col", "aggregation": "sum"|"avg"|"count"|"none", "insight": "one sentence"}
  ]
}
Use EXACT column names. Return exactly 4 charts covering different aspects of the data.`,
    },
  ]
  const raw = await queryLLM(messages, userKey)
  return JSON.parse(raw)
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

// ─── Forecast & Trend helpers ─────────────────────────────────────────────────

function buildForecast(data, xKey, yKey, periods) {
  if (!data.length || periods <= 0) return []
  const nums = data.map(d => Number(d[yKey])).filter(v => !isNaN(v))
  if (nums.length < 2) return []
  // Simple linear extrapolation from last two values
  const n = nums.length
  const last = nums[n - 1]
  const slope = (nums[n - 1] - nums[Math.max(0, n - Math.min(n, 6))]) / Math.min(n - 1, 5)
  const lastX = data[data.length - 1][xKey]
  const result = []
  for (let i = 1; i <= periods; i++) {
    result.push({ [xKey]: `${lastX}+${i}`, [yKey]: Math.max(0, last + slope * i), _forecast: true })
  }
  return result
}

function buildTrendPoints(data, xKey, yKey) {
  const pts = data.map((d, i) => [i, Number(d[yKey])]).filter(([, y]) => !isNaN(y))
  if (pts.length < 2) return []
  const n = pts.length
  const sumX = pts.reduce((s, [x]) => s + x, 0)
  const sumY = pts.reduce((s, [, y]) => s + y, 0)
  const sumXY = pts.reduce((s, [x, y]) => s + x * y, 0)
  const sumXX = pts.reduce((s, [x]) => s + x * x, 0)
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1)
  const intercept = (sumY - slope * sumX) / n
  return [
    { [xKey]: data[0][xKey], _trend: intercept },
    { [xKey]: data[n - 1][xKey], _trend: intercept + slope * (n - 1) },
  ]
}

// ─── Chart Renderer ───────────────────────────────────────────────────────────

function ChartRenderer({
  config, data, columns, height = 420,
  colors = PALETTES.datadropai,
  showAvgLine = false,
  showDataLabels = false,
  showTrendLine = false,
  forecastPeriods = 0,
  showDualYAxis = false,
  stackedBar = false,
}) {
  const { chartType, xAxis, yAxis, groupBy } = config
  const yAxes = Array.isArray(yAxis) ? yAxis : [yAxis].filter(Boolean)
  const ax   = { stroke: 'var(--ln2)', tick: { fill: 'var(--t3)', fontSize: 11 } }
  const mg   = { top: 8, right: showDualYAxis ? 48 : 24, bottom: 8, left: 12 }
  const grid = <CartesianGrid strokeDasharray="3 3" stroke="var(--ln)" />
  const leg  = <Legend wrapperStyle={{ color: 'var(--t3)', fontSize: 11 }} />
  const barAnim  = { isAnimationActive: true, animationDuration: 500, animationEasing: 'ease-out' }
  const lineAnim = { isAnimationActive: true, animationDuration: 700, animationEasing: 'ease-in-out' }

  // Average reference line
  const _yKey = yAxes[0]
  const _yNums = showAvgLine && _yKey ? data.map(d => Number(d[_yKey])).filter(v => !isNaN(v)) : []
  const avgVal = _yNums.length ? _yNums.reduce((a, b) => a + b, 0) / _yNums.length : null
  const avgLine = showAvgLine && avgVal !== null
    ? <ReferenceLine y={avgVal} stroke="var(--afg)" strokeDasharray="5 3" strokeWidth={1.5}
        label={{ value: `avg ${fmtTick(avgVal)}`, position: 'insideTopRight', fontSize: 9, fill: 'var(--afg)', dy: -4 }} />
    : null

  // Data label renderer (shared)
  function renderLabel({ x, y, width, height: h, value }) {
    if (!showDataLabels || value == null) return null
    const isH = h > width
    return (
      <text x={isH ? x + width + 4 : x + width / 2} y={isH ? y + h / 2 + 4 : y - 4}
        textAnchor={isH ? 'start' : 'middle'} fill="var(--t3)" fontSize={9}>
        {fmtTick(value)}
      </text>
    )
  }

  if (chartType === 'bar') {
    const isH = !stackedBar && data.length > 9
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
            {groups.map((g, i) => (
              <Bar key={g} dataKey={g} fill={colors[i % colors.length]}
                radius={stackedBar ? 0 : (isH ? [0,3,3,0] : [3,3,0,0])}
                stackId={stackedBar ? 'stack' : undefined} {...barAnim}>
                {showDataLabels && <LabelList content={renderLabel} />}
              </Bar>
            ))}
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
          {yAxes.map((col, i) => (
            <Bar key={col} dataKey={col} fill={colors[i % colors.length]}
              radius={stackedBar ? 0 : (isH ? [0,3,3,0] : [3,3,0,0])}
              stackId={stackedBar ? 'stack' : undefined} {...barAnim}>
              {showDataLabels && <LabelList content={renderLabel} />}
            </Bar>
          ))}
          {avgLine}
        </BarChart>
      </ResponsiveContainer>
    )
  }

  if (chartType === 'line') {
    const { pivoted, groups: grps } = groupBy ? pivotGroupBy(data, xAxis, groupBy, yAxes[0]) : {}
    const renderData = groupBy ? pivoted : data
    const keys = groupBy ? grps : yAxes
    const forecast = !groupBy && forecastPeriods > 0
      ? buildForecast(data, xAxis, yAxes[0], forecastPeriods)
      : []
    const allData = [...renderData, ...forecast]
    const trendPts = showTrendLine && !groupBy ? buildTrendPoints(renderData, xAxis, yAxes[0]) : []
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={allData} margin={mg}>
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
          {forecast.length > 0 && (
            <Line dataKey={yAxes[0]} data={[...renderData.slice(-1), ...forecast]}
              stroke={colors[0]} strokeWidth={1.5} strokeDasharray="5 3" dot={false}
              isAnimationActive={false} legendType="none" />
          )}
          {trendPts.length === 2 && (
            <ReferenceLine
              segment={[
                { x: trendPts[0][xAxis], y: trendPts[0]._trend },
                { x: trendPts[1][xAxis], y: trendPts[1]._trend },
              ]}
              stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 3" />
          )}
          {avgLine}
        </LineChart>
      </ResponsiveContainer>
    )
  }

  if (chartType === 'area') {
    const forecast = forecastPeriods > 0 ? buildForecast(data, xAxis, yAxes[0], forecastPeriods) : []
    const allData = [...data, ...forecast]
    const trendPts = showTrendLine ? buildTrendPoints(data, xAxis, yAxes[0]) : []
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={allData} margin={mg}>
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
          {forecast.length > 0 && (
            <Area dataKey={yAxes[0]} data={[...data.slice(-1), ...forecast]}
              stroke={colors[0]} fill="none" strokeWidth={1.5} strokeDasharray="5 3"
              isAnimationActive={false} legendType="none" dot={false} />
          )}
          {trendPts.length === 2 && (
            <ReferenceLine
              segment={[
                { x: trendPts[0][xAxis], y: trendPts[0]._trend },
                { x: trendPts[1][xAxis], y: trendPts[1]._trend },
              ]}
              stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 3" />
          )}
          {avgLine}
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  if (chartType === 'scatter') {
    const trendPts = showTrendLine ? buildTrendPoints(data, xAxis, yAxes[0]) : []
    return (
      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart margin={mg}>
          {grid}
          <XAxis dataKey={xAxis} type="number" {...ax} name={xAxis} tickFormatter={fmtTick} />
          <YAxis dataKey={yAxes[0]} {...ax} name={yAxes[0]} tickFormatter={fmtTick} />
          <Tooltip contentStyle={TT} cursor={{ strokeDasharray: '3 3', stroke: 'var(--ln3)' }} />
          <Scatter data={data} fill={colors[0]} fillOpacity={0.75} />
          {trendPts.length === 2 && (
            <ReferenceLine
              segment={[
                { x: Number(trendPts[0][xAxis]), y: trendPts[0]._trend },
                { x: Number(trendPts[1][xAxis]), y: trendPts[1]._trend },
              ]}
              stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 3" />
          )}
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

  if (chartType === 'funnel') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <FunnelChart margin={mg}>
          <Tooltip content={<CustomTooltip />} />
          <Funnel dataKey={yAxes[0]} data={data} isAnimationActive={true} animationDuration={700}>
            {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            {showDataLabels && (
              <LabelList position="right" fill="var(--t3)" stroke="none" dataKey={xAxis} fontSize={11} />
            )}
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
    )
  }

  if (chartType === 'composed') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={mg}>
          {grid}
          <XAxis dataKey={xAxis} {...ax} />
          <YAxis yAxisId="left" {...ax} tickFormatter={fmtTick} />
          {showDualYAxis && yAxes.length > 1 && (
            <YAxis yAxisId="right" orientation="right" {...ax} tickFormatter={fmtTick} />
          )}
          <Tooltip content={<CustomTooltip />} />
          {leg}
          {yAxes.map((col, i) =>
            i === 0
              ? <Bar key={col} yAxisId="left" dataKey={col} fill={colors[0]} radius={[3,3,0,0]} fillOpacity={0.85} {...barAnim}>
                  {showDataLabels && <LabelList content={renderLabel} />}
                </Bar>
              : <Line key={col} yAxisId={showDualYAxis && i === 1 ? 'right' : 'left'}
                  type="monotone" dataKey={col} stroke={colors[i % colors.length]} strokeWidth={2} dot={false} {...lineAnim} />
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

// ─── API Key Popover ──────────────────────────────────────────────────────────

function ApiKeyPopover({ apiKey, onApiKey }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function close(e) { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const hasKey = apiKey.trim().length > 0

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} title="Groq API key"
        className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border transition-all ${
          hasKey
            ? 'bg-[#10b981]/8 border-[#10b981]/20 text-[#10b981]'
            : 'bg-[var(--sf2)] border-[var(--ln2)] text-[var(--t4)] hover:text-[var(--t2)] hover:border-[var(--ln3)]'
        }`}>
        <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
          <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M8.5 8.5l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          <path d="M10 11.5l1-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        {hasKey ? 'Key ✓' : 'Key'}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 bg-[var(--sf3)] border border-[var(--ln2)] rounded-xl p-3.5 z-40 w-[260px]"
          style={{ boxShadow: 'var(--shadow-lg)' }}>
          <p className="text-[11px] font-semibold text-[var(--t2)] mb-2.5">Groq API key</p>
          <input
            type="password"
            placeholder="gsk_…"
            value={apiKey}
            autoFocus
            onChange={e => onApiKey(e.target.value)}
            className="w-full bg-[var(--sf)] border border-[var(--ln2)] focus:border-[#6366f1]/50 rounded-lg px-3 py-2 text-[12px] font-mono text-[var(--t1)] placeholder:text-[var(--t4)] focus:outline-none transition-colors"
          />
          <p className="text-[10px] text-[var(--t4)] mt-2.5 leading-relaxed">
            Optional — uses a shared rate-limited key by default.{' '}
            <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer"
              className="text-[var(--afg)] hover:underline">Get a free key →</a>
          </p>
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

function DataTable({ data, heatmap = false }) {
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [showHeatmap, setShowHeatmap] = useState(heatmap)

  if (!data.length) return null
  const cols = Object.keys(data[0]).filter(k => !k.startsWith('_'))

  // Compute per-column min/max for heatmap coloring (numeric cols only)
  const colRanges = {}
  if (showHeatmap) {
    cols.forEach(col => {
      const nums = data.map(r => Number(r[col])).filter(v => !isNaN(v))
      if (nums.length > 1) colRanges[col] = { min: Math.min(...nums), max: Math.max(...nums) }
    })
  }

  function cellStyle(col, val) {
    if (!showHeatmap) return {}
    const range = colRanges[col]
    if (!range) return {}
    const n = Number(val)
    if (isNaN(n)) return {}
    const t = (n - range.min) / (range.max - range.min || 1)
    return { backgroundColor: `rgba(99,102,241,${(t * 0.35).toFixed(2)})`, color: t > 0.6 ? 'var(--t1)' : undefined }
  }

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
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
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
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
        <button onClick={() => setShowHeatmap(h => !h)}
          title="Toggle heatmap coloring"
          className={`shrink-0 text-[11px] px-2.5 py-1.5 rounded-lg border transition-all ${
            showHeatmap
              ? 'bg-[#6366f1]/12 border-[#6366f1]/25 text-[var(--afg)]'
              : 'border-[var(--ln2)] text-[var(--t4)] hover:text-[var(--t2)]'
          }`}>
          Heatmap
        </button>
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
                  <td key={col} style={cellStyle(col, row[col])}
                    className="px-3 py-2 text-[var(--t2)] whitespace-nowrap max-w-[200px] truncate transition-colors">
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

// ─── Dataset Profile ──────────────────────────────────────────────────────────

function DatasetProfile({ profile, loading }) {
  const [open, setOpen] = useState(true)
  if (!loading && !profile) return null
  const roleColor = { metric: '#6366f1', dimension: '#10b981', id: '#71717a', date: '#f59e0b' }
  const roleBg    = { metric: 'bg-[#6366f1]/10', dimension: 'bg-[#10b981]/10', id: 'bg-[#71717a]/10', date: 'bg-[#f59e0b]/10' }
  return (
    <div className="bg-[var(--sf)] border border-[var(--ln)] rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-[12px] text-[var(--t3)] hover:text-[var(--t1)] transition-colors">
        <span className="flex items-center gap-2 font-medium">
          <span className="text-[var(--afg)]">✦</span> What this data measures
        </span>
        <span className="text-[10px] text-[var(--t5)]">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="border-t border-[var(--ln)] px-4 py-3 space-y-3">
          {loading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-3 bg-[var(--sf2)] rounded w-3/4" />
              <div className="flex gap-1.5 flex-wrap">
                {[80, 64, 96, 72].map(w => <div key={w} style={{ width: w }} className="h-6 bg-[var(--sf2)] rounded-full" />)}
              </div>
            </div>
          ) : (
            <>
              {profile.summary && (
                <p className="text-[12px] text-[var(--t2)] leading-relaxed">{profile.summary}</p>
              )}
              {Array.isArray(profile.columns) && (
                <div className="flex flex-wrap gap-1.5">
                  {profile.columns.map(col => (
                    <span key={col.name} title={col.description}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] border border-transparent ${roleBg[col.role] || 'bg-[var(--sf2)]'} cursor-default`}>
                      <span style={{ color: roleColor[col.role] || 'var(--t4)' }} className="text-[9px] font-bold uppercase">
                        {col.role}
                      </span>
                      <span className="text-[var(--t2)]">{col.name}</span>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-3 pt-0.5">
                {Object.entries({ metric: '#6366f1', dimension: '#10b981', date: '#f59e0b', id: '#71717a' }).map(([role, color]) => (
                  <span key={role} className="flex items-center gap-1 text-[10px] text-[var(--t5)]">
                    <span style={{ background: color }} className="w-1.5 h-1.5 rounded-full inline-block" />
                    {role}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Anomaly Panel ────────────────────────────────────────────────────────────

function AnomalyPanel({ anomalies, loading }) {
  const [open, setOpen] = useState(false)
  if (!loading && !anomalies.length) return null
  const sevColor = { high: 'text-red-400', medium: 'text-amber-400', low: 'text-[var(--t4)]' }
  const sevBg    = { high: 'bg-red-400/10 border-red-400/20', medium: 'bg-amber-400/10 border-amber-400/20', low: 'bg-[var(--sf2)] border-[var(--ln)]' }
  return (
    <div className="bg-[var(--sf)] border border-[var(--ln)] rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-[12px] hover:text-[var(--t1)] transition-colors">
        <span className="flex items-center gap-2 font-medium text-[var(--t3)]">
          <span className={loading ? 'text-[var(--t5)]' : anomalies.some(a => a.severity === 'high') ? 'text-red-400' : 'text-amber-400'}>⚠</span>
          Data quality
          {!loading && anomalies.length > 0 && (
            <span className="bg-amber-400/15 text-amber-400 text-[10px] px-1.5 py-0.5 rounded-full font-medium">
              {anomalies.length} issue{anomalies.length !== 1 ? 's' : ''}
            </span>
          )}
        </span>
        <span className="text-[10px] text-[var(--t5)]">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="border-t border-[var(--ln)] px-4 py-3 space-y-2">
          {loading ? (
            <div className="animate-pulse space-y-2">
              {[1,2].map(i => <div key={i} className="h-10 bg-[var(--sf2)] rounded-lg" />)}
            </div>
          ) : anomalies.map((a, i) => (
            <div key={i} className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border ${sevBg[a.severity] || sevBg.low}`}>
              <span className={`text-[10px] font-bold uppercase shrink-0 mt-0.5 ${sevColor[a.severity] || 'text-[var(--t4)]'}`}>
                {a.severity}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-[var(--t2)]">{a.column} — {a.issue}</p>
                <p className="text-[11px] text-[var(--t4)] mt-0.5 leading-relaxed">{a.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Filter Panel ─────────────────────────────────────────────────────────────

function FilterPanel({ columns, rows, filters, onFilters, onClose }) {
  const catCols = columns.filter(c => c.type === 'categorical').slice(0, 8)
  return (
    <div className="bg-[var(--sf)] border border-[var(--ln2)] rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-medium text-[var(--t2)]">Column filters</p>
        <button onClick={onClose} className="text-[11px] text-[var(--t4)] hover:text-[var(--t2)] transition-colors">✕ Close</button>
      </div>
      {catCols.length === 0 && (
        <p className="text-[12px] text-[var(--t4)]">No categorical columns to filter.</p>
      )}
      {catCols.map(col => {
        const counts = {}
        rows.forEach(r => { const v = String(r[col.name] ?? ''); counts[v] = (counts[v] || 0) + 1 })
        const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 20)
        const excluded = filters[col.name] || new Set()
        return (
          <div key={col.name} className="space-y-1.5">
            <p className="text-[11px] font-medium text-[var(--t3)]">{col.name}</p>
            <div className="flex flex-wrap gap-1">
              {top.map(([val]) => {
                const isExcluded = excluded.has(val)
                return (
                  <button key={val}
                    onClick={() => {
                      const next = new Set(excluded)
                      isExcluded ? next.delete(val) : next.add(val)
                      onFilters({ ...filters, [col.name]: next })
                    }}
                    className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${
                      isExcluded
                        ? 'line-through border-[var(--ln)] text-[var(--t5)] bg-[var(--sf2)]'
                        : 'border-[var(--ln2)] text-[var(--t3)] hover:border-[var(--ln3)] hover:text-[var(--t1)]'
                    }`}>
                    {val}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
      <button onClick={() => onFilters({})}
        className="text-[11px] text-[var(--t4)] hover:text-red-400 transition-colors">
        Clear all filters
      </button>
    </div>
  )
}

// ─── Workspace Modal ──────────────────────────────────────────────────────────

function WorkspaceModal({ workspaces, onSave, onLoad, onDelete, onClose }) {
  const [name, setName] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[var(--sf)] border border-[var(--ln2)] rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl space-y-5"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-[var(--t1)]">Saved workspaces</h3>
          <button onClick={onClose} className="text-[var(--t4)] hover:text-[var(--t1)] transition-colors">✕</button>
        </div>
        <div className="flex gap-2">
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="Workspace name…"
            onKeyDown={e => { if (e.key === 'Enter' && name.trim()) { onSave(name.trim()); setName('') } }}
            className="flex-1 bg-[var(--bg)] border border-[var(--ln2)] rounded-lg px-3 py-2 text-[12px] text-[var(--t1)] placeholder:text-[var(--t5)] focus:outline-none focus:border-[#6366f1]/50 transition-colors" />
          <button onClick={() => { if (name.trim()) { onSave(name.trim()); setName('') } }} disabled={!name.trim()}
            className="bg-[#6366f1] hover:bg-[#5254cc] disabled:opacity-30 text-white text-[12px] px-4 py-2 rounded-lg transition-colors whitespace-nowrap">
            Save
          </button>
        </div>
        {workspaces.length === 0 ? (
          <p className="text-[12px] text-[var(--t5)] text-center py-4">No saved workspaces yet.</p>
        ) : (
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {workspaces.map((ws, i) => (
              <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-[var(--sf2)] transition-colors group">
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-[var(--t2)] truncate">{ws.name}</p>
                  <p className="text-[10px] text-[var(--t5)]">{ws.cols} cols · {ws.pins?.length ?? 0} pins</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => onLoad(ws)}
                    className="text-[11px] text-[var(--afg)] hover:underline transition-colors px-2">Load</button>
                  <button onClick={() => onDelete(i)}
                    className="text-[11px] text-[var(--t5)] hover:text-red-400 transition-colors px-1">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Mini chart helpers (shared by LandingPage + DataInput) ───────────────────

function MiniBar({ values, color = '#6366f1' }) {
  const max = Math.max(...values) || 1
  const W = 64, H = 24, n = values.length
  const gap = 2, bw = (W - gap * (n - 1)) / n
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {values.map((v, i) => {
        const h = Math.max(2, (v / max) * (H - 1))
        return <rect key={i} x={i * (bw + gap)} y={H - h} width={bw} height={h}
          rx={1.5} fill={color} fillOpacity={0.45 + (v / max) * 0.45} />
      })}
    </svg>
  )
}

function MiniLine({ values, color = '#10b981' }) {
  const min = Math.min(...values), max = Math.max(...values), range = max - min || 1
  const W = 64, H = 24
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * W,
    H - 2 - ((v - min) / range) * (H - 5),
  ])
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Alert Panel ──────────────────────────────────────────────────────────────

const ALERT_OPS  = ['>', '<', '>=', '<=', '=']
const ALERT_AGGS = [
  { value: 'any',  label: 'Any row' },
  { value: 'avg',  label: 'Average' },
  { value: 'max',  label: 'Maximum' },
  { value: 'min',  label: 'Minimum' },
]

function AlertPanel({ alerts, columns, triggeredIds, onAdd, onRemove, onToggle, onClose }) {
  const numCols = columns.filter(c => c.type === 'numeric')
  const [col,   setCol]   = useState(numCols[0]?.name || '')
  const [op,    setOp]    = useState('>')
  const [val,   setVal]   = useState('')
  const [agg,   setAgg]   = useState('avg')
  const [label, setLabel] = useState('')

  function submit() {
    if (!col || !val.trim() || !label.trim()) return
    onAdd({ label: label.trim(), column: col, op, value: Number(val), aggregate: agg, enabled: true })
    setLabel(''); setVal('')
  }

  const sel = 'bg-[var(--sf)] border border-[var(--ln2)] rounded-lg px-2 py-1.5 text-[12px] text-[var(--t2)] focus:outline-none cursor-pointer transition-colors'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[var(--sf)] border border-[var(--ln2)] rounded-2xl p-5 w-full max-w-md mx-4 shadow-2xl space-y-5"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-semibold text-[var(--t1)]">Alerts</h3>
            <p className="text-[11px] text-[var(--t4)] mt-0.5">Get notified when a threshold is crossed</p>
          </div>
          <button onClick={onClose} className="text-[var(--t4)] hover:text-[var(--t2)] transition-colors">✕</button>
        </div>

        {/* Add form */}
        {numCols.length > 0 ? (
          <div className="bg-[var(--sf2)] border border-[var(--ln)] rounded-xl p-3.5 space-y-3">
            <p className="text-[11px] font-semibold text-[var(--t3)] uppercase tracking-wider">New alert</p>
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Label, e.g. Revenue drops"
              className="w-full bg-[var(--bg)] border border-[var(--ln2)] rounded-lg px-3 py-1.5 text-[12px] text-[var(--t1)] placeholder:text-[var(--t5)] focus:outline-none focus:border-[#6366f1]/50 transition-colors" />
            <div className="flex gap-2 flex-wrap">
              <select value={agg} onChange={e => setAgg(e.target.value)} className={sel}>
                {ALERT_AGGS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
              <select value={col} onChange={e => setCol(e.target.value)} className={`${sel} flex-1 min-w-0`}>
                {numCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
              <select value={op} onChange={e => setOp(e.target.value)} className={sel}>
                {ALERT_OPS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <input type="number" value={val} onChange={e => setVal(e.target.value)} placeholder="value"
                className={`${sel} w-24 font-mono`} />
            </div>
            <button onClick={submit} disabled={!col || !val.trim() || !label.trim()}
              className="w-full bg-[#6366f1] hover:bg-[#5254cc] disabled:opacity-30 text-white text-[12px] font-semibold py-2 rounded-lg transition-colors">
              Add alert
            </button>
          </div>
        ) : (
          <p className="text-[12px] text-[var(--t4)] text-center py-2">Load a dataset with numeric columns to define alerts.</p>
        )}

        {/* Alert list */}
        {alerts.length > 0 && (
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {alerts.map(a => {
              const fired = triggeredIds.includes(a.id)
              return (
                <div key={a.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                  fired ? 'bg-red-400/8 border-red-400/25' : 'bg-[var(--sf2)] border-[var(--ln)]'
                }`}>
                  <button onClick={() => onToggle(a.id)}
                    className={`w-8 h-4 rounded-full transition-colors shrink-0 ${a.enabled ? 'bg-[#6366f1]' : 'bg-[var(--ln3)]'}`}>
                    <span className={`block w-3 h-3 rounded-full bg-white mx-0.5 transition-transform ${a.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-[var(--t1)] truncate">{a.label}</p>
                    <p className="text-[10px] text-[var(--t5)]">{ALERT_AGGS.find(x=>x.value===a.aggregate)?.label} of {a.column} {a.op} {a.value}</p>
                  </div>
                  {fired && <span className="text-[10px] font-bold text-red-400 shrink-0">FIRED</span>}
                  <button onClick={() => onRemove(a.id)} className="text-[var(--t5)] hover:text-red-400 transition-colors shrink-0 text-[11px]">✕</button>
                </div>
              )
            })}
          </div>
        )}
        {alerts.length === 0 && numCols.length > 0 && (
          <p className="text-[12px] text-[var(--t5)] text-center pb-1">No alerts defined yet.</p>
        )}
      </div>
    </div>
  )
}

// ─── Onboarding Modal ─────────────────────────────────────────────────────────

const ONBOARDING_STEPS = [
  { icon: '📂', title: 'Load your data', body: 'Drop a CSV or JSON file, paste rows directly, fetch from a URL, or try one of the built-in sample datasets.' },
  { icon: '💬', title: 'Ask in plain English', body: 'Type any question — "Show sales by region" or "Top 10 products by revenue" — and the AI picks the right chart and axes automatically.' },
  { icon: '⚙️', title: 'Refine without re-querying', body: 'Use the X / Y / Group / Agg dropdowns to instantly swap axes. Toggle Avg, Trend, Stack, or Forecast in one click. The Where button lets you filter rows with expressions like sales > 1000.' },
  { icon: '📌', title: 'Build a dashboard', body: 'Pin any chart to your dashboard. Drag to reorder, add notes, then export the whole thing as a PNG or share via link.' },
  { icon: '⌨️', title: 'Keyboard shortcuts', body: '⌘K — focus the query bar\nF — fullscreen chart\n⌘Z — undo last chart\nEsc — close/blur\n? — open this guide' },
]

function OnboardingModal({ onClose }) {
  const [step, setStep] = useState(0)
  const isLast = step === ONBOARDING_STEPS.length - 1
  const s = ONBOARDING_STEPS[step]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[var(--sf)] border border-[var(--ln2)] rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex gap-1.5">
            {ONBOARDING_STEPS.map((_, i) => (
              <button key={i} onClick={() => setStep(i)}
                className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-[#6366f1]' : 'w-1.5 bg-[var(--ln2)] hover:bg-[var(--ln3)]'}`} />
            ))}
          </div>
          <button onClick={onClose} className="text-[var(--t4)] hover:text-[var(--t2)] transition-colors text-[13px]">✕</button>
        </div>
        <div className="text-center space-y-3 mb-6">
          <div className="text-3xl">{s.icon}</div>
          <h3 className="text-[16px] font-semibold text-[var(--t1)]">{s.title}</h3>
          <p className="text-[13px] text-[var(--t3)] leading-relaxed whitespace-pre-line">{s.body}</p>
        </div>
        <div className="flex gap-2">
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)}
              className="flex-1 text-[13px] font-medium border border-[var(--ln2)] text-[var(--t3)] hover:text-[var(--t1)] hover:border-[var(--ln3)] px-4 py-2.5 rounded-xl transition-colors">
              ← Back
            </button>
          )}
          <button onClick={isLast ? onClose : () => setStep(s => s + 1)}
            className="flex-1 text-[13px] font-semibold bg-[#6366f1] hover:bg-[#5254cc] text-white px-4 py-2.5 rounded-xl transition-colors">
            {isLast ? 'Get started' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Landing Page ─────────────────────────────────────────────────────────────

function LandingPage({ onGetStarted, onSample, theme, onToggleTheme }) {

  const samplePreviews = {
    coffee:  <MiniBar  values={[8200,6100,4800,4200,3900,3600,3100,2800,2600,2200]} color="#6366f1" />,
    stocks:  <MiniLine values={[185,182,171,165,191,210,218,226,233,229,237,243]}   color="#10b981" />,
    olympics:<MiniBar  values={[40,40,20,18,16,15,14,13,12,12]}                     color="#f59e0b" />,
    saas:    <MiniLine values={[12000,14500,16200,18800,21500,24200,27000,30500,34200,38000,42500,47800]} color="#6366f1" />,
  }

  return (
    <div className="min-h-screen bg-[var(--bg-d)] text-[var(--t1)]">

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-20 border-b border-[var(--ln)] backdrop-blur-md"
        style={{ backgroundColor: 'var(--nav-blur)' }}>
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo size={20} />
            <span className="text-[15px] font-semibold tracking-tight">DataDropAI</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            <button onClick={onGetStarted}
              className="text-[13px] font-semibold bg-[#6366f1] hover:bg-[#5254cc] text-white px-4 py-1.5 rounded-lg transition-colors">
              Open app
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden dot-grid">
        {/* Ambient glows */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div style={{ position:'absolute', top:'-10%', left:'50%', transform:'translateX(-50%)', width:800, height:500, borderRadius:'50%', background:'radial-gradient(ellipse, rgba(99,102,241,0.13) 0%, transparent 65%)', filter:'blur(60px)' }} />
          <div style={{ position:'absolute', top:'20%', right:'-5%', width:400, height:400, borderRadius:'50%', background:'radial-gradient(ellipse, rgba(245,158,11,0.07) 0%, transparent 70%)', filter:'blur(50px)' }} />
        </div>

        <div className="relative max-w-5xl mx-auto px-6 pt-24 pb-10 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-[#6366f1]/10 border border-[#6366f1]/18 text-[var(--afg)] text-[11px] px-3 py-1.5 rounded-full mb-10 font-semibold tracking-wide">
            <span className="w-1.5 h-1.5 bg-[#6366f1] rounded-full inline-block animate-pulse" />
            Powered by Groq · Free to use
          </div>

          {/* Headline */}
          <h1 className="text-[56px] sm:text-[80px] font-bold tracking-[-0.04em] leading-[0.9] mb-6">
            Ask your data
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-br from-[#a5b4fc] via-[#818cf8] to-[#6366f1]">
              anything.
            </span>
          </h1>

          {/* Subtext */}
          <p className="text-[var(--t3)] text-[17px] sm:text-[19px] max-w-[480px] mx-auto mb-10 leading-relaxed">
            Drop a CSV or Google Sheet. Ask a question in plain English.
            Get an interactive chart in seconds.
          </p>

          {/* CTAs */}
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button onClick={onGetStarted}
              className="bg-[#6366f1] hover:bg-[#5254cc] text-white text-[14px] font-semibold px-7 py-3 rounded-xl transition-all"
              style={{ boxShadow: '0 0 0 0 rgba(99,102,241,0)', transition: 'background-color 0.15s, box-shadow 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.boxShadow='0 4px 20px rgba(99,102,241,0.35)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow='none'}>
              Upload your data →
            </button>
            <button onClick={() => onSample(SAMPLES[3])}
              className="text-[14px] font-medium text-[var(--t3)] hover:text-[var(--t1)] border border-[var(--ln2)] hover:border-[var(--ln3)] bg-[var(--sf)] hover:bg-[var(--sf2)] px-7 py-3 rounded-xl transition-all">
              Try a demo
            </button>
          </div>
        </div>

        {/* Product mockup */}
        <div className="relative max-w-2xl mx-auto px-6 pb-24 mt-14">
          <div className="bg-[var(--sf)] border border-[var(--ln2)] rounded-2xl overflow-hidden"
            style={{ boxShadow: '0 0 0 1px rgba(99,102,241,0.08), var(--shadow-lg)' }}>

            {/* Window chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--ln)] bg-[var(--sf2)]">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--ln3)]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--ln3)]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--ln3)]" />
              <div className="flex-1 mx-3 h-5 bg-[var(--sf3)] rounded-md" />
            </div>

            {/* Query row */}
            <div className="px-4 py-3 border-b border-[var(--ln)]">
              <div className="flex items-center gap-3 bg-[var(--sf2)] border border-[var(--ln2)] rounded-xl px-4 py-2.5">
                <span className="text-[13px] text-[var(--t2)] flex-1 text-left">Show me MRR growth by month as a line chart</span>
                <span className="shrink-0 bg-[#6366f1] text-white text-[11px] font-semibold px-3 py-1 rounded-lg">Ask</span>
              </div>
            </div>

            {/* Chart area */}
            <div className="px-5 pt-4 pb-5">
              {/* Card header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[13px] font-semibold text-[var(--t1)]">MRR Growth by Month</p>
                  <span className="text-[9px] bg-[#6366f1]/10 text-[var(--afg)] px-2 py-0.5 rounded-md mt-1 inline-block font-semibold tracking-widest uppercase">Line</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] bg-[var(--sf2)] border border-[var(--ln2)] text-[var(--t4)] px-2.5 py-1 rounded-lg">Share</span>
                  <span className="text-[11px] bg-[var(--sf2)] border border-[var(--ln2)] text-[var(--t4)] px-2.5 py-1 rounded-lg">Pin</span>
                </div>
              </div>

              {/* Mini line chart */}
              <svg width="100%" viewBox="0 0 480 110" preserveAspectRatio="none" style={{ display:'block', height:110 }}>
                {/* Grid lines */}
                {[25, 50, 75].map(y => (
                  <line key={y} x1={0} y1={y} x2={480} y2={y} stroke="rgba(99,102,241,0.06)" strokeWidth={1} />
                ))}
                {/* Area fill */}
                <path
                  d="M0,95 L40,88 L80,80 L120,70 L160,58 L200,46 L240,38 L280,26 L320,20 L360,14 L400,9 L440,5 L480,2 L480,105 L0,105 Z"
                  fill="url(#mgrd)" fillOpacity="0.25" />
                <defs>
                  <linearGradient id="mgrd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Line */}
                <path
                  d="M0,95 L40,88 L80,80 L120,70 L160,58 L200,46 L240,38 L280,26 L320,20 L360,14 L400,9 L440,5 L480,2"
                  fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                {/* Dot at peak */}
                <circle cx="480" cy="2" r="3.5" fill="#6366f1" />
                {/* Month labels */}
                {['Jan','Mar','May','Jul','Sep','Nov'].map((m, i) => (
                  <text key={m} x={i * 96} y={108} fontSize={9} fill="var(--t4)" textAnchor="middle">{m}</text>
                ))}
              </svg>

              {/* Insight */}
              <div className="mt-3 flex items-start gap-2 border-t border-[var(--ln)] pt-3">
                <span className="w-1 h-1 rounded-full bg-[var(--afg)] mt-1.5 shrink-0" />
                <p className="text-[11px] text-[var(--t3)] leading-relaxed">
                  MRR grew <span className="text-[var(--t2)] font-medium">4× in 12 months</span>, with the steepest acceleration between July and September.
                </p>
              </div>
            </div>
          </div>

          {/* Floating label */}
          <p className="text-center text-[11px] text-[var(--t5)] mt-5 tracking-wide">
            Built with your actual data · nothing stored server-side
          </p>
        </div>
      </section>

      {/* ── Sample datasets ── */}
      <section className="border-t border-[var(--ln)] max-w-5xl mx-auto px-6 py-16">
        <p className="text-[11px] text-[var(--t4)] uppercase tracking-widest font-semibold mb-6 text-center">
          Or start with a sample dataset
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {SAMPLES.map(s => (
            <button key={s.id} onClick={() => onSample(s)}
              className="group bg-[var(--sf)] border border-[var(--ln)] hover:border-[#6366f1]/30 rounded-2xl p-4 text-left transition-all hover:-translate-y-px"
              style={{ boxShadow: 'var(--shadow-sm)' }}>
              <div className="mb-3 opacity-80 group-hover:opacity-100 transition-opacity">
                {samplePreviews[s.id] ?? <span className="text-2xl">{s.emoji}</span>}
              </div>
              <p className="text-[12px] font-semibold text-[var(--t2)] group-hover:text-[var(--t1)] transition-colors leading-snug">{s.name}</p>
              <p className="text-[11px] text-[var(--t5)] mt-0.5 leading-snug group-hover:text-[var(--t4)] transition-colors">{s.description}</p>
            </button>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="border-t border-[var(--ln)] max-w-5xl mx-auto px-6 py-20">
        <p className="text-[11px] text-[var(--t4)] uppercase tracking-widest font-semibold mb-12 text-center">
          How it works
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
          {[
            {
              n: '01',
              title: 'Drop your data',
              body: 'Upload a CSV, paste JSON, or connect a Google Sheet — no formatting or cleanup required.',
              icon: (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <rect x="3" y="2" width="14" height="16" rx="2.5" stroke="#6366f1" strokeWidth="1.4"/>
                  <path d="M7 7h6M7 10h6M7 13h4" stroke="#6366f1" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              ),
            },
            {
              n: '02',
              title: 'Ask in plain English',
              body: '"Show top 10 by revenue as a bar chart" — the AI picks the right chart type, axes, and grouping.',
              icon: (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M3 5.5h14M3 10h10M3 14.5h7" stroke="#6366f1" strokeWidth="1.4" strokeLinecap="round"/>
                  <circle cx="16" cy="14.5" r="2.5" stroke="#6366f1" strokeWidth="1.4"/>
                  <path d="M17.8 16.3l1.5 1.5" stroke="#6366f1" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              ),
            },
            {
              n: '03',
              title: 'Explore & share',
              body: 'Pin charts to a dashboard, export as PNG or Excel, or share a live link. Your data never leaves the browser.',
              icon: (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <rect x="2" y="10" width="4" height="8" rx="1" fill="#6366f1" fillOpacity="0.9"/>
                  <rect x="8" y="6" width="4" height="12" rx="1" fill="#6366f1" fillOpacity="0.65"/>
                  <rect x="14" y="2" width="4" height="16" rx="1" fill="#6366f1" fillOpacity="0.4"/>
                </svg>
              ),
            },
          ].map(step => (
            <div key={step.n} className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-bold text-[var(--afg)] opacity-60 tabular">{step.n}</span>
                <div className="w-px h-3 bg-[var(--ln3)]" />
                <div className="w-8 h-8 bg-[#6366f1]/8 border border-[#6366f1]/15 rounded-xl flex items-center justify-center">
                  {step.icon}
                </div>
              </div>
              <h3 className="text-[14px] font-semibold text-[var(--t1)] leading-snug">{step.title}</h3>
              <p className="text-[13px] text-[var(--t3)] leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[var(--ln)]">
        <div className="max-w-5xl mx-auto px-6 py-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={15} />
            <span className="text-[13px] font-medium text-[var(--t4)]">DataDropAI</span>
          </div>
          <p className="text-[11px] text-[var(--t5)]">Groq · Recharts · Vite · Free & open source</p>
        </div>
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

function Dashboard({ pins, onUnpin, onReorder, onUpdateNote, onClose, colors, theme, onShare, dashCopied }) {
  const [dragIdx, setDragIdx] = useState(null)
  const [overIdx, setOverIdx] = useState(null)

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

  function handleDrop(toIdx) {
    if (dragIdx === null || dragIdx === toIdx) return
    onReorder(dragIdx, toIdx)
    setDragIdx(null)
    setOverIdx(null)
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
          <p className="text-[var(--t4)] text-[13px] mt-0.5">{pins.length} pinned chart{pins.length !== 1 ? 's' : ''} · drag to reorder</p>
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
          <div key={i}
            draggable
            onDragStart={() => setDragIdx(i)}
            onDragOver={e => { e.preventDefault(); setOverIdx(i) }}
            onDragLeave={() => setOverIdx(null)}
            onDrop={() => handleDrop(i)}
            onDragEnd={() => { setDragIdx(null); setOverIdx(null) }}
            className={`bg-[var(--sf)] border rounded-2xl p-5 space-y-4 transition-all cursor-grab active:cursor-grabbing select-none ${
              overIdx === i && dragIdx !== i
                ? 'border-[#6366f1]/50 bg-[#6366f1]/3 scale-[1.01]'
                : dragIdx === i
                ? 'border-[var(--ln3)] opacity-50'
                : 'border-[var(--ln)]'
            }`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex items-center gap-2">
                <span className="text-[var(--t5)] text-[12px] shrink-0 cursor-grab">⠿</span>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[var(--t1)] leading-snug truncate">{pin.config.title}</p>
                  <p className="text-[11px] text-[var(--t4)] mt-0.5 truncate">{pin.query}</p>
                </div>
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
            <textarea
              value={pin.note || ''}
              onChange={e => onUpdateNote(i, e.target.value)}
              placeholder="Add a note…"
              rows={1}
              className="w-full bg-[var(--bg)] border border-[var(--ln)] rounded-lg px-3 py-2 text-[11px] text-[var(--t3)] placeholder:text-[var(--t5)] focus:outline-none focus:border-[#6366f1]/40 resize-none transition-colors"
              style={{ minHeight: 32 }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Data Input ───────────────────────────────────────────────────────────────

function DataInput({ onCSV, onJSON, onURL, onSample, onFile, onFiles, onLiveReload, onLiveReloadSecs }) {
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

  const pasteFormat = paste.trim().startsWith('{') || paste.trim().startsWith('[') ? 'JSON' : paste.trim() ? 'CSV' : null

  const sampleMiniCharts = {
    coffee:   <MiniBar  values={[8200,6100,4800,4200,3900,3600,3100,2800,2600,2200]} color="#6366f1" />,
    stocks:   <MiniLine values={[185,182,171,165,191,210,218,226,233,229,237,243]}   color="#10b981" />,
    olympics: <MiniBar  values={[40,40,20,18,16,15,14,13,12,12]}                     color="#f59e0b" />,
    saas:     <MiniLine values={[12000,14500,16200,18800,21500,24200,27000,30500,34200,38000,42500,47800]} color="#6366f1" />,
  }

  const TABS = [
    { k: 'upload', label: 'File',
      icon: <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 10V3m0 0L5 6m3-3l3 3" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 13h12" strokeLinecap="round"/></svg> },
    { k: 'multi', label: 'Multi',
      icon: <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 7l7-3.5L15 7l-7 3.5L1 7z" strokeLinejoin="round"/><path d="M1 11l7 3.5 7-3.5" strokeLinecap="round" strokeLinejoin="round"/></svg> },
    { k: 'paste', label: 'Paste',
      icon: <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="5" width="12" height="9" rx="1.5"/><path d="M5 5V4a1 1 0 011-1h4a1 1 0 011 1v1" strokeLinejoin="round"/></svg> },
    { k: 'url', label: 'URL',
      icon: <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6.5 9.5l3-3" strokeLinecap="round"/><path d="M4.5 8.5L3 10a3 3 0 004.243 4.243L8.5 13" strokeLinecap="round" strokeLinejoin="round"/><path d="M11.5 7.5L13 6a3 3 0 00-4.243-4.243L7.5 3" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  ]

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* ── Sample cards ── */}
      <div className="space-y-3">
        <p className="text-[11px] text-[var(--t4)] uppercase tracking-widest font-medium text-center">
          Try a sample dataset
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SAMPLES.map(s => (
            <button
              key={s.id}
              onClick={() => onSample(s)}
              className="group bg-[var(--sf)] border border-[var(--ln)] hover:border-[#6366f1]/40 hover:bg-[#6366f1]/5 rounded-xl p-3 text-left transition-all hover:-translate-y-px"
            >
              <div className="flex items-start justify-between mb-2.5">
                <p className="text-[11px] font-semibold text-[var(--t2)] group-hover:text-[var(--t1)] transition-colors leading-tight">{s.name}</p>
                <div className="opacity-50 group-hover:opacity-80 transition-opacity shrink-0 ml-1">
                  {sampleMiniCharts[s.id] ?? <span className="text-lg">{s.emoji}</span>}
                </div>
              </div>
              <p className="text-[10px] text-[var(--t4)] leading-snug">{s.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-[var(--ln)]" />
        <span className="text-[11px] text-[var(--t5)]">or bring your own</span>
        <div className="flex-1 h-px bg-[var(--ln)]" />
      </div>

      {/* ── Tabs + content ── */}
      <div className="space-y-4">

        {/* Tab bar */}
        <div className="flex gap-0.5 bg-[var(--sf2)] border border-[var(--ln2)] rounded-xl p-1 w-fit mx-auto">
          {TABS.map(({ k, label, icon }) => (
            <button key={k} onClick={() => setTab(k)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] transition-all ${
                tab === k
                  ? 'bg-[var(--sf3)] text-[var(--t1)]'
                  : 'text-[var(--t4)] hover:text-[var(--t2)]'
              }`}>
              {icon}
              {label}
            </button>
          ))}
        </div>

        {/* ── Upload ── */}
        {tab === 'upload' && (
          <div
            onDrop={e => { e.preventDefault(); setDragging(false); e.dataTransfer.files[0] && readFile(e.dataTransfer.files[0]) }}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onClick={() => document.getElementById('_fi').click()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer select-none transition-all ${
              dragging
                ? 'border-[#6366f1] bg-[#6366f1]/5'
                : 'border-[var(--ln2)] hover:border-[var(--ln3)] hover:bg-[var(--sf)]'
            }`}
          >
            <svg className={`w-8 h-8 mx-auto mb-3 transition-colors ${dragging ? 'text-[#6366f1]' : 'text-[var(--t4)]'}`}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 15V4m0 0l-4 4m4-4l4 4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4 20h16" strokeLinecap="round"/>
            </svg>
            <p className={`text-sm font-medium mb-1 transition-colors ${dragging ? 'text-[var(--t1)]' : 'text-[var(--t2)]'}`}>
              {dragging ? 'Drop to load' : 'Drop a file here'}
            </p>
            <p className="text-[var(--t4)] text-xs mb-4">or click to browse</p>
            <div className="flex items-center justify-center gap-1.5">
              {['.csv', '.tsv', '.json'].map(ext => (
                <span key={ext} className="text-[10px] font-mono bg-[var(--sf2)] border border-[var(--ln)] text-[var(--t4)] px-2 py-0.5 rounded-md">{ext}</span>
              ))}
            </div>
            <input id="_fi" type="file" accept=".csv,.tsv,.json,.txt" className="hidden"
              onChange={e => e.target.files[0] && readFile(e.target.files[0])} />
          </div>
        )}

        {/* ── Multi ── */}
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
              <svg className={`w-8 h-8 mx-auto mb-3 transition-colors ${multiDragging ? 'text-[#6366f1]' : 'text-[var(--t4)]'}`}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 6l8-4 8 4-8 4-8-4z" strokeLinejoin="round"/>
                <path d="M4 12l8 4 8-4" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M4 18l8 4 8-4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p className="text-[var(--t2)] text-sm font-medium mb-1">Drop multiple CSV files</p>
              <p className="text-[var(--t4)] text-xs mb-5">
                All files will be merged — a{' '}
                <code className="font-mono bg-[var(--sf2)] border border-[var(--ln)] text-[var(--t3)] px-1.5 py-0.5 rounded text-[10px]">source_file</code>
                {' '}column is added automatically
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={e => { e.stopPropagation(); document.getElementById('_fi_multi').click() }}
                  className="text-[13px] font-medium bg-[#6366f1] hover:bg-[#5254cc] text-white px-4 py-2 rounded-lg transition-colors">
                  Select files
                </button>
                <button
                  onClick={e => { e.stopPropagation(); document.getElementById('_fi_folder').click() }}
                  className="text-[13px] font-medium bg-[var(--sf2)] border border-[var(--ln2)] hover:border-[var(--ln3)] text-[var(--t2)] px-4 py-2 rounded-lg transition-colors">
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

        {/* ── Paste ── */}
        {tab === 'paste' && (
          <div className="space-y-2.5">
            <div className="relative">
              <textarea value={paste} onChange={e => setPaste(e.target.value)}
                placeholder={'name,sales,region\nApple,4200,West\nBanana,3100,East'}
                className="w-full h-44 bg-[var(--sf)] border border-[var(--ln)] rounded-xl px-4 py-3 pr-28 text-sm text-[var(--t1)] placeholder:text-[var(--t5)] focus:outline-none focus:border-[#6366f1]/50 font-mono resize-none transition-colors" />
              <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 pointer-events-none">
                {pasteFormat && (
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                    pasteFormat === 'JSON'
                      ? 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20'
                      : 'bg-[#6366f1]/10 text-[var(--afg)] border-[#6366f1]/20'
                  }`}>{pasteFormat}</span>
                )}
                {paste && (
                  <span className="text-[10px] text-[var(--t5)] tabular">{paste.length.toLocaleString()}</span>
                )}
              </div>
            </div>
            <button onClick={handlePaste} disabled={!paste.trim()}
              className="bg-[#6366f1] hover:bg-[#5254cc] disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
              Load data
            </button>
          </div>
        )}

        {/* ── URL ── */}
        {tab === 'url' && (
          <div className="space-y-2.5">
            <input type="url" value={url} onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && url.trim() && onURL(url.trim())}
              placeholder="https://docs.google.com/spreadsheets/d/… or any CSV / JSON URL"
              className="w-full bg-[var(--sf)] border border-[var(--ln)] rounded-xl px-4 py-3 text-sm text-[var(--t1)] placeholder:text-[var(--t4)] focus:outline-none focus:border-[#6366f1]/50 transition-colors" />
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={() => url.trim() && onURL(url.trim())} disabled={!url.trim()}
                className="bg-[#6366f1] hover:bg-[#5254cc] disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
                Fetch & load
              </button>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[var(--t4)]">Auto-refresh</span>
                <select value={onLiveReloadSecs || 0}
                  onChange={e => onLiveReload && onLiveReload(url.trim(), Number(e.target.value))}
                  className="bg-[var(--sf2)] border border-[var(--ln)] rounded-lg px-2 py-1 text-[11px] text-[var(--t3)] focus:outline-none cursor-pointer">
                  <option value={0}>Off</option>
                  <option value={30}>30s</option>
                  <option value={60}>1m</option>
                  <option value={300}>5m</option>
                  <option value={600}>10m</option>
                </select>
              </div>
            </div>
            <div className="flex items-start gap-1.5 pt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34a853] shrink-0 mt-[3px]" />
              <span className="text-[11px] text-[var(--t5)] leading-relaxed">Google Sheets URLs are auto-converted — make sure the sheet is shared publicly</span>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// ─── SmartOverview ────────────────────────────────────────────────────────────

function SmartOverview({ overview, loading, anomalies, onQuestion, onShowAnomalies }) {
  return (
    <div className="space-y-5 chart-fade-in">

      {/* ── Headline ── */}
      {loading && !overview ? (
        <div className="space-y-2 pt-1">
          <div className="h-7 bg-[var(--sf2)] rounded-xl animate-pulse" style={{ width: '68%' }} />
          <div className="h-5 bg-[var(--sf2)] rounded-xl animate-pulse" style={{ width: '45%' }} />
        </div>
      ) : overview?.headline ? (
        <h2 className="text-[21px] font-semibold text-[var(--t1)] leading-snug tracking-tight pt-1">
          <FormatInsight text={overview.headline} />
        </h2>
      ) : null}

      {/* ── Key insights ── */}
      {loading && !overview ? (
        <div className="space-y-2.5">
          {[72, 58, 64].map((w, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--sf3)] shrink-0" />
              <div className="h-3.5 bg-[var(--sf2)] rounded-lg animate-pulse" style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
      ) : overview?.insights?.length > 0 ? (
        <div className="space-y-2.5">
          {overview.insights.map((ins, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#6366f1] shrink-0 mt-[5px]" />
              <p className="text-[13px] text-[var(--t2)] leading-relaxed">
                <FormatInsight text={ins} />
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {/* ── Anomaly notice (subtle) ── */}
      {anomalies.length > 0 && (
        <button onClick={onShowAnomalies}
          className="flex items-center gap-1.5 text-[11px] text-[var(--t5)] hover:text-amber-400 transition-colors group">
          <span className="text-amber-400/60 group-hover:text-amber-400 transition-colors text-[12px]">⚠</span>
          {anomalies.length} potential data issue{anomalies.length !== 1 ? 's' : ''} detected
          <span className="text-[var(--t5)] group-hover:text-[var(--t3)] transition-colors">· view details →</span>
        </button>
      )}

      {/* ── Suggested questions ── */}
      {overview?.questions?.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-[10px] font-semibold text-[var(--t5)] uppercase tracking-widest">Start exploring</p>
          <div className="flex flex-wrap gap-1.5">
            {overview.questions.map(q => (
              <button key={q} onClick={() => onQuestion(q)}
                className="text-[12px] bg-[#6366f1]/5 border border-[#6366f1]/15 hover:border-[#6366f1]/30 text-[var(--afg)] hover:bg-[#6366f1]/10 px-4 py-2 rounded-full transition-colors">
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

// ─── FormatInsight ────────────────────────────────────────────────────────────

function FormatInsight({ text }) {
  if (!text) return null
  // Bold numbers (integers, decimals, percentages, currency prefixed)
  const parts = text.split(/(\$?[\d,]+\.?\d*%?(?:\s*[xX])?)/g)
  return (
    <>
      {parts.map((part, i) =>
        /^\$?[\d,]+\.?\d*%?(?:\s*[xX])?$/.test(part) && part !== ''
          ? <strong key={i} className="font-semibold text-[var(--t1)]">{part}</strong>
          : <span key={i}>{part}</span>
      )}
    </>
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
  const [showDataLabels, setShowDataLabels] = useState(false)
  const [showTrendLine, setShowTrendLine]   = useState(false)
  const [forecastPeriods, setForecastPeriods] = useState(0)
  const [showDualYAxis, setShowDualYAxis]   = useState(false)
  const [stackedBar, setStackedBar]         = useState(false)
  const [rowFilterExpr, setRowFilterExpr]   = useState('')
  const [showRowFilter, setShowRowFilter]   = useState(false)
  const [streamingText, setStreamingText]   = useState('')
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('datadropai_onboarded'))
  const [lastUpdatedAt, setLastUpdatedAt]   = useState(null)
  const [trends, setTrends]                 = useState(null)
  const [eli5Mode, setEli5Mode]             = useState(false)
  const [alerts, setAlerts]                 = useState(() => {
    try { return JSON.parse(localStorage.getItem('datadropai_alerts') || '[]') } catch { return [] }
  })
  const [showAlerts, setShowAlerts]         = useState(false)
  const [alertTriggered, setAlertTriggered] = useState([]) // ids triggered this session
  const [focusMode, setFocusMode]           = useState(false)
  const [queryFocused, setQueryFocused]     = useState(false)
  const [chartTypeOpen, setChartTypeOpen]   = useState(false)
  const [showDatasetDetails, setShowDatasetDetails] = useState(false)
  const [smartOverview, setSmartOverview]     = useState(null)
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [hasQueried, setHasQueried]           = useState(false)
  const [chartHidden, setChartHidden]         = useState(false)

  const [undoStack, setUndoStack]       = useState([])
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft]     = useState('')
  const [explanation, setExplanation]   = useState(null)
  const [explanationLoading, setExplanationLoading] = useState(false)
  const [anomalies, setAnomalies]       = useState([])
  const [anomaliesLoading, setAnomaliesLoading] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)

  const [profile, setProfile]           = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)

  const [columnFilters, setColumnFilters] = useState({})
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [calcColExpr, setCalcColExpr]   = useState('')
  const [showCalcCol, setShowCalcCol]   = useState(false)

  const [savedWorkspaces, setSavedWorkspaces] = useState(() => {
    try { return JSON.parse(localStorage.getItem('datadropai_workspaces') || '[]') } catch { return [] }
  })
  const [showWorkspaces, setShowWorkspaces] = useState(false)

  const [liveReloadSecs, setLiveReloadSecs] = useState(0)
  const [liveReloadUrl, setLiveReloadUrl]   = useState('')

  const chartRef     = useRef(null)
  const queryInputRef = useRef(null)
  const exportMenuRef = useRef(null)

  const activeColors = PALETTES[palette] ?? PALETTES.datadropai

  function closeOnboarding() {
    setShowOnboarding(false)
    localStorage.setItem('datadropai_onboarded', '1')
  }

  // ── Alerts ──

  function saveAlerts(next) {
    setAlerts(next)
    localStorage.setItem('datadropai_alerts', JSON.stringify(next))
  }

  function addAlert(alert) {
    const next = [...alerts, { ...alert, id: Date.now().toString() }]
    saveAlerts(next)
    // Request browser notification permission on first alert
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }

  function removeAlert(id) { saveAlerts(alerts.filter(a => a.id !== id)) }
  function toggleAlert(id) { saveAlerts(alerts.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a)) }

  function checkAndFireAlerts(currentRows) {
    if (!currentRows.length || !alerts.length) return
    const evalOp = (op, a, b) => ({ '>': a>b, '<': a<b, '>=': a>=b, '<=': a<=b, '=': a===b }[op] ?? false)
    const newlyTriggered = []
    alerts.forEach(alert => {
      if (!alert.enabled) return
      const vals = currentRows.map(r => Number(r[alert.column])).filter(v => !isNaN(v))
      if (!vals.length) return
      const candidate = {
        any:  vals.some(v => evalOp(alert.op, v, alert.value)),
        avg:  evalOp(alert.op, vals.reduce((a,b)=>a+b,0)/vals.length, alert.value),
        max:  evalOp(alert.op, Math.max(...vals), alert.value),
        min:  evalOp(alert.op, Math.min(...vals), alert.value),
      }[alert.aggregate] ?? false
      if (candidate && !alertTriggered.includes(alert.id)) {
        newlyTriggered.push(alert.id)
        addToast(`Alert: ${alert.label}`, 'error')
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('DataDropAI Alert', { body: alert.label, silent: false })
        }
      }
    })
    if (newlyTriggered.length) {
      setAlertTriggered(prev => [...prev, ...newlyTriggered])
    }
  }

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
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !isInput) {
        e.preventDefault()
        setUndoStack(prev => {
          if (!prev.length) return prev
          const [last, ...rest] = prev
          setChartConfig(last.config)
          setChartData(last.data)
          setChartId(id => id + 1)
          return rest
        })
      }
      if (e.key === 'Escape') {
        if (showOnboarding) closeOnboarding()
        else if (fullscreen) setFullscreen(false)
        else if (showFilterPanel) setShowFilterPanel(false)
        else if (showWorkspaces) setShowWorkspaces(false)
        else if (isInput) document.activeElement.blur()
      }
      if (e.key === 'f' && !isInput && !fullscreen && chartConfig) {
        setFullscreen(true)
      }
      if (e.key === '?' && !isInput) {
        setShowOnboarding(true)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [fullscreen, showFilterPanel, showWorkspaces, showOnboarding, chartConfig])

  // ── Global paste (Cmd+V) CSV/JSON ──
  useEffect(() => {
    function handlePaste(e) {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const text = e.clipboardData?.getData('text')
      if (!text?.trim()) return
      const t = text.trim()
      if (t.startsWith('{') || t.startsWith('[')) loadJSON(t)
      else if (t.includes(',') || t.includes('\t')) loadCSV(t)
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [])

  // ── Live-reload interval ──
  useEffect(() => {
    if (!liveReloadSecs || !liveReloadUrl) return
    const id = setInterval(() => {
      loadURL(liveReloadUrl)
      // rows may not be updated yet; alert check fires via the data-load effect
    }, liveReloadSecs * 1000)
    return () => clearInterval(id)
  }, [liveReloadSecs, liveReloadUrl])

  // ── Export menu click-outside ──
  useEffect(() => {
    if (!exportOpen) return
    function close(e) { if (!exportMenuRef.current?.contains(e.target)) setExportOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [exportOpen])

  // ── Chart type dropdown click-outside ──
  useEffect(() => {
    if (!chartTypeOpen) return
    function close() { setChartTypeOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [chartTypeOpen])

  // ── Auto-focus query input when data loads ──
  useEffect(() => {
    if (dataLoaded) setTimeout(() => queryInputRef.current?.focus(), 200)
  }, [dataLoaded])

  // ── AI suggestions + profile + anomalies ──
  useEffect(() => {
    if (!dataLoaded || !columns.length || !rows.length) return
    const key = apiKey.trim()

    setSuggestionsLoading(true)
    setSuggestions([])
    generateSuggestions(columns, rows, key)
      .then(s => setSuggestions(s))
      .catch(() => setSuggestions([]))
      .finally(() => setSuggestionsLoading(false))

    setProfileLoading(true)
    setProfile(null)
    generateDatasetProfile(columns, rows, key)
      .then(p => setProfile(p))
      .catch(() => setProfile(null))
      .finally(() => setProfileLoading(false))

    setAnomaliesLoading(true)
    setAnomalies([])
    detectAnomalies(columns, rows, key)
      .then(a => setAnomalies(a))
      .catch(() => setAnomalies([]))
      .finally(() => setAnomaliesLoading(false))
    checkAndFireAlerts(rows)
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
    setQuery('')
    setChartView('chart')
    setSuggestions([])
    setProfile(null)
    setAnomalies([])
    setColumnFilters({})
    setUndoStack([])
    setExplanation(null)
    setPage('app')
    setRowWarning(newRows.length > 10_000)
    setLastUpdatedAt(Date.now())
    setTrends(computeTrends(newRows, inferColumns(newRows)))
    setAlertTriggered([])
    setHasQueried(false)
    setChartHidden(false)

    // ── Set initial chart immediately (client-side, no AI) ──
    const initCfg = pickInitialChart(cols)
    if (initCfg) {
      const agg = aggregateData(newRows, initCfg, cols)
      const { data: sampled } = sampleForChart(agg, initCfg.chartType)
      setChartConfig(initCfg)
      setChartData(sampled)
    } else {
      setChartConfig(null)
      setChartData([])
    }

    // ── Smart Overview context (AI, async) ──
    setSmartOverview(null)
    setOverviewLoading(true)
    generateSmartOverview(cols, newRows, apiKey.trim())
      .then(ov => setSmartOverview(ov))
      .catch(() => setSmartOverview(null))
      .finally(() => setOverviewLoading(false))
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
      setLastUpdatedAt(Date.now())
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
    setRowWarning(false); setProfile(null); setAnomalies([])
    setColumnFilters({}); setUndoStack([]); setExplanation(null)
    setLiveReloadSecs(0); setLiveReloadUrl('')
    setRowFilterExpr(''); setShowRowFilter(false)
    setSmartOverview(null); setOverviewLoading(false)
    setHasQueried(false); setChartHidden(false)
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
    setExplanation(null)
    setLoadingMsg('Analyzing your data…')
    setHasQueried(true)

    try {
      const systemPrompt = buildSystemPrompt(columns, rows)
      const messages = [{ role: 'system', content: systemPrompt }]
      if (chartConfig) {
        messages.push({ role: 'assistant', content: JSON.stringify(chartConfig) })
      }
      messages.push({ role: 'user', content: question })
      setLoadingMsg('Asking AI…')
      setStreamingText('')
      const raw = await streamQueryLLM(messages, apiKey.trim(), (partial) => {
        setStreamingText(partial)
        const m = partial.match(/"title"\s*:\s*"([^"\\]{3,60})/)
        if (m) setLoadingMsg(`Building: ${m[1]}`)
      })
      setStreamingText('')
      setLoadingMsg('Building chart…')

      let parsed
      try { parsed = JSON.parse(raw) }
      catch {
        const match = raw.match(/\{[\s\S]*\}/)
        if (!match) throw new Error('No JSON returned — try rephrasing.')
        parsed = JSON.parse(match[0])
      }

      // Insight-only answer (no chart)
      if (parsed.answerType === 'insight' && parsed.answer) {
        setChartConfig({ ...parsed, answerType: 'insight', title: question })
        setChartData([])
        setChartId(prev => prev + 1)
        setLoading(false); setLoadingMsg('')
        return
      }

      if (!parsed.chartType || !parsed.xAxis) {
        throw new Error('Couldn\'t determine a chart. Try: "bar chart of sales by region"')
      }

      const config = normalizeConfig(parsed, columns)

      // Apply row expression filter + column filters from UI
      let sourceRows = applyRowFilter(rows, rowFilterExpr)
      Object.entries(columnFilters).forEach(([col, excluded]) => {
        if (excluded.size > 0) {
          sourceRows = sourceRows.filter(r => !excluded.has(String(r[col] ?? '')))
        }
      })

      // Apply AI filter
      if (config.filter?.column && Array.isArray(config.filter.values) && config.filter.values.length) {
        const col = config.filter.column
        const vals = new Set(config.filter.values.map(v => String(v).toLowerCase()))
        const filtered = sourceRows.filter(r => vals.has(String(r[col] ?? '').toLowerCase()))
        if (filtered.length) sourceRows = filtered
      }

      let processed = aggregateData(sourceRows, config, columns)
      if (!processed.length) throw new Error('Aggregation returned no data. Try different grouping.')

      // Apply sort + limit
      if (config.sortBy && config.sortBy !== 'none') {
        const sortKey = config.sortBy === 'yAxis'
          ? (Array.isArray(config.yAxis) ? config.yAxis[0] : config.yAxis)
          : config.xAxis
        processed = [...processed].sort((a, b) => {
          const av = Number(a[sortKey]), bv = Number(b[sortKey])
          const cmp = !isNaN(av) && !isNaN(bv) ? av - bv : String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? ''))
          return config.sortOrder === 'asc' ? cmp : -cmp
        })
      }
      if (config.limit) {
        processed = processed.slice(0, config.limit)
      }

      const { data: chartSampled, sampled, total } = sampleForChart(processed, config.chartType)
      setSampledNotice(sampled ? { total, shown: chartSampled.length } : null)

      // Push undo before replacing
      if (chartConfig && chartData.length) {
        setUndoStack(prev => [{ config: chartConfig, data: chartData }, ...prev].slice(0, 20))
      }

      setChartConfig(config)
      setChartData(chartSampled)
      setChartId(prev => prev + 1)
      setChartHistory(prev => [{ config, data: processed, columns, query: question }, ...prev].slice(0, 12))

      // Auto-explain every chart (non-blocking)
      setExplanationLoading(true)
      setExplanation(null)
      explainChart(config, chartSampled, apiKey.trim(), eli5Mode)
        .then(r => setExplanation(r.explanation || null))
        .catch(() => setExplanation(null))
        .finally(() => setExplanationLoading(false))
    } catch (e) {
      if (e.status === 429 || e.message?.toLowerCase().includes('rate limit')) {
        setRateLimitEnd(Date.now() + 60_000)
      } else {
        setError(e.message || 'Something went wrong generating the chart.')
      }
    } finally {
      setLoading(false)
      setLoadingMsg('')
      setStreamingText('')
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
    setStackedBar(false)
  }

  // ── New handlers ──

  function exportXLSX() {
    if (!chartData.length) return
    const cols = Object.keys(chartData[0]).filter(k => !k.startsWith('_'))
    const ws = XLSX.utils.aoa_to_sheet([cols, ...chartData.map(row => cols.map(c => row[c] ?? ''))])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Chart Data')
    XLSX.writeFile(wb, `datadropai-${Date.now()}.xlsx`)
    addToast('Excel exported')
  }

  function exportSVG() {
    const svgEl = chartRef.current?.querySelector('svg')
    if (!svgEl) { addToast('No SVG found — PNG export works for all chart types', 'error'); return }
    const xml = new XMLSerializer().serializeToString(svgEl)
    const blob = new Blob([xml], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `datadropai-${Date.now()}.svg`; a.click()
    URL.revokeObjectURL(url)
    addToast('SVG exported')
  }

  function copyEmbedCode() {
    if (!chartConfig) return
    const payload = encodeShare({ config: chartConfig, data: chartData.slice(0, 150), columns })
    if (!payload) return
    const src = `${location.origin}${location.pathname}?c=${payload}`
    const code = `<iframe src="${src}" width="800" height="500" frameborder="0" style="border-radius:12px;border:1px solid #e5e7eb"></iframe>`
    navigator.clipboard.writeText(code).catch(() => {})
    addToast('Embed code copied to clipboard')
  }

  function addCalculatedColumn(expr) {
    if (!expr.trim() || !rows.length) return
    try {
      const cols = Object.keys(rows[0])
      // Safe eval: only allow access to column values, no globals
      const fn = new Function(...cols, `"use strict"; return (${expr})`)
      const colName = `calc_${expr.replace(/[^a-z0-9]/gi, '_').slice(0, 20)}`
      const newRows = rows.map(r => {
        try {
          const val = fn(...cols.map(c => Number(r[c]) || r[c]))
          return { ...r, [colName]: String(val ?? '') }
        } catch { return { ...r, [colName]: '' } }
      })
      loadData(newRows, dataLabel)
      addToast(`Column "${colName}" added`)
      setShowCalcCol(false)
      setCalcColExpr('')
    } catch (e) { addToast('Expression error: ' + e.message, 'error') }
  }

  function updateAxis(field, value) {
    if (!chartConfig || !rows.length) return
    const newConfig = normalizeConfig({ ...chartConfig, [field]: value }, columns)
    let sourceRows = applyRowFilter(rows, rowFilterExpr)
    Object.entries(columnFilters).forEach(([col, excluded]) => {
      if (excluded.size > 0) sourceRows = sourceRows.filter(r => !excluded.has(String(r[col] ?? '')))
    })
    if (newConfig.filter?.column && newConfig.filter.values?.length) {
      const col = newConfig.filter.column
      const vals = new Set(newConfig.filter.values.map(v => String(v).toLowerCase()))
      const filtered = sourceRows.filter(r => vals.has(String(r[col] ?? '').toLowerCase()))
      if (filtered.length) sourceRows = filtered
    }
    let processed = aggregateData(sourceRows, newConfig, columns)
    if (!processed.length) return
    if (newConfig.sortBy && newConfig.sortBy !== 'none') {
      const sortKey = newConfig.sortBy === 'yAxis'
        ? (Array.isArray(newConfig.yAxis) ? newConfig.yAxis[0] : newConfig.yAxis)
        : newConfig.xAxis
      processed = [...processed].sort((a, b) => {
        const av = Number(a[sortKey]), bv = Number(b[sortKey])
        const cmp = !isNaN(av) && !isNaN(bv) ? av - bv : String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? ''))
        return newConfig.sortOrder === 'asc' ? cmp : -cmp
      })
    }
    if (newConfig.limit) processed = processed.slice(0, newConfig.limit)
    const { data: sampled } = sampleForChart(processed, newConfig.chartType)
    setUndoStack(prev => [{ config: chartConfig, data: chartData }, ...prev].slice(0, 20))
    setChartConfig(newConfig)
    setChartData(sampled)
    setChartId(id => id + 1)
  }

  function exportAllData() {
    if (!rows.length) return
    const cols = Object.keys(rows[0])
    const csvRows = rows.map(row =>
      cols.map(c => {
        const v = String(row[c] ?? '')
        return v.includes(',') || v.includes('"') || v.includes('\n')
          ? `"${v.replace(/"/g, '""')}"` : v
      }).join(',')
    )
    const blob = new Blob([[cols.join(','), ...csvRows].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${(dataLabel || 'data').replace(/[^a-z0-9]/gi, '_')}-${Date.now()}.csv`; a.click()
    URL.revokeObjectURL(url)
    addToast(`Exported ${rows.length.toLocaleString()} rows`)
  }

  function reorderPins(fromIdx, toIdx) {
    setPins(prev => {
      const arr = [...prev]
      const [item] = arr.splice(fromIdx, 1)
      arr.splice(toIdx, 0, item)
      return arr
    })
  }

  function updatePinNote(idx, note) {
    setPins(prev => prev.map((p, i) => i === idx ? { ...p, note } : p))
  }

  function saveWorkspace(name) {
    const ws = {
      name,
      cols: columns.length,
      columns,
      chartConfig,
      chartData,
      pins: pins.slice(0, 10),
      palette,
      savedAt: Date.now(),
    }
    const updated = [ws, ...savedWorkspaces].slice(0, 20)
    setSavedWorkspaces(updated)
    localStorage.setItem('datadropai_workspaces', JSON.stringify(updated))
    addToast(`Workspace "${name}" saved`)
  }

  function loadWorkspace(ws) {
    if (ws.columns?.length) setColumns(ws.columns)
    if (ws.chartConfig) { setChartConfig(ws.chartConfig); setChartData(ws.chartData || []) }
    if (ws.pins?.length) setPins(ws.pins)
    if (ws.palette) setPalette(ws.palette)
    setChartId(prev => prev + 1)
    setShowWorkspaces(false)
    addToast(`Workspace "${ws.name}" loaded`)
  }

  function deleteWorkspace(idx) {
    const updated = savedWorkspaces.filter((_, i) => i !== idx)
    setSavedWorkspaces(updated)
    localStorage.setItem('datadropai_workspaces', JSON.stringify(updated))
  }

  async function runExplain(forceEli5 = eli5Mode) {
    if (!chartConfig || !chartData.length) return
    setExplanationLoading(true)
    setExplanation(null)
    try {
      const result = await explainChart(chartConfig, chartData, apiKey.trim(), forceEli5)
      setExplanation(result.explanation || null)
    } catch { setExplanation(null) }
    finally { setExplanationLoading(false) }
  }

  async function runReport() {
    if (!rows.length) { setError('Re-upload your data first.'); return }
    setReportLoading(true)
    addToast('Generating full report…')
    try {
      const result = await generateReport(columns, rows, apiKey.trim())
      if (!Array.isArray(result.charts) || !result.charts.length) throw new Error('No charts returned')
      const newPins = result.charts.map(cfg => {
        const config = normalizeConfig({ ...cfg, insight: cfg.insight }, columns)
        let processed = aggregateData(rows, config, columns)
        if (!processed.length) processed = rows.slice(0, 20)
        const { data } = sampleForChart(processed, config.chartType)
        return { config, data, columns, query: 'Auto-report' }
      }).filter(p => p.data.length)
      setPins(prev => [...newPins, ...prev].slice(0, 20))
      setView('dashboard')
      addToast(`Report generated — ${newPins.length} charts pinned`)
      if (result.narrative) addToast(result.narrative.slice(0, 80) + (result.narrative.length > 80 ? '…' : ''))
    } catch (e) { addToast('Report generation failed: ' + e.message, 'error') }
    finally { setReportLoading(false) }
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

      {/* Onboarding modal */}
      {showOnboarding && <OnboardingModal onClose={closeOnboarding} />}

      {/* Alert panel */}
      {showAlerts && (
        <AlertPanel
          alerts={alerts}
          columns={columns}
          triggeredIds={alertTriggered}
          onAdd={addAlert}
          onRemove={removeAlert}
          onToggle={toggleAlert}
          onClose={() => setShowAlerts(false)}
        />
      )}

      {/* Workspace modal */}
      {showWorkspaces && (
        <WorkspaceModal
          workspaces={savedWorkspaces}
          onSave={saveWorkspace}
          onLoad={loadWorkspace}
          onDelete={deleteWorkspace}
          onClose={() => setShowWorkspaces(false)}
        />
      )}

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
      <header className="sticky top-0 z-20 border-b border-[var(--ln)] backdrop-blur-sm"
        style={{ backgroundColor: 'var(--nav-blur)' }}>
        <div className="max-w-5xl mx-auto px-6 h-12 flex items-center justify-between gap-4">

          {/* Left: logo + view switcher */}
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={goHome}
              className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-[var(--sf2)] transition-colors shrink-0">
              <Logo size={17} />
              <span className="text-[13px] font-semibold tracking-tight">DataDropAI</span>
            </button>

            {dataLoaded && (
              <>
                <span className="w-px h-3.5 bg-[var(--ln3)] shrink-0" />
                {/* Segmented view control */}
                <div className="flex items-center bg-[var(--sf2)] border border-[var(--ln)] rounded-lg p-0.5 shrink-0">
                  <button onClick={() => setView('explore')}
                    className={`text-[11px] font-medium px-3 py-1 rounded-md transition-colors ${
                      view === 'explore'
                        ? 'bg-[var(--sf3)] text-[var(--t1)]'
                        : 'text-[var(--t4)] hover:text-[var(--t2)]'
                    }`}>
                    Explore
                  </button>
                  <button onClick={() => setView('dashboard')}
                    className={`text-[11px] font-medium px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                      view === 'dashboard'
                        ? 'bg-[var(--sf3)] text-[var(--t1)]'
                        : 'text-[var(--t4)] hover:text-[var(--t2)]'
                    }`}>
                    Dashboard
                    {pins.length > 0 && (
                      <span className="bg-[#6366f1] text-white text-[9px] w-4 h-4 rounded-full leading-none font-bold flex items-center justify-center tabular">
                        {pins.length}
                      </span>
                    )}
                  </button>
                </div>

                {/* Active file pill */}
                <div className="hidden sm:flex items-center gap-1.5 bg-[var(--sf2)] border border-[var(--ln)] rounded-lg px-2.5 py-1 min-w-0 max-w-[180px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6366f1] shrink-0" />
                  <span className="text-[11px] text-[var(--t3)] truncate">{dataLabel}</span>
                </div>
              </>
            )}
          </div>

          {/* Right: alerts + help + theme + api key */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => setShowAlerts(true)} title="Alerts"
              className={`relative w-7 h-7 flex items-center justify-center rounded-lg text-[13px] text-[var(--t4)] hover:text-[var(--t2)] hover:bg-[var(--sf2)] border border-transparent hover:border-[var(--ln2)] transition-all ${alertTriggered.length ? 'text-red-400' : ''}`}>
              🔔
              {alertTriggered.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-400 rounded-full border-2 border-[var(--bg)]" />
              )}
            </button>
            <button onClick={() => setShowOnboarding(true)} title="Help (?) "
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[11px] font-semibold text-[var(--t4)] hover:text-[var(--t2)] hover:bg-[var(--sf2)] border border-transparent hover:border-[var(--ln2)] transition-all">
              ?
            </button>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <ApiKeyPopover
              apiKey={apiKey}
              onApiKey={v => { setApiKey(v); localStorage.setItem('datadropai_key', v) }}
            />
          </div>

        </div>
      </header>

      {/* Dashboard view */}
      {view === 'dashboard' && (
        <Dashboard
          pins={pins}
          onUnpin={unpinChart}
          onReorder={reorderPins}
          onUpdateNote={updatePinNote}
          onClose={() => setView('explore')}
          colors={activeColors}
          theme={theme}
          onShare={shareDashboard}
          dashCopied={dashCopied}
        />
      )}

      {/* Explore view */}
      {view === 'explore' && (
        <main className="max-w-4xl mx-auto px-6 pt-8 pb-36 space-y-8">

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
                <DataInput onCSV={loadCSV} onJSON={loadJSON} onURL={loadURL} onSample={loadSample} onFile={loadCSVFile} onFiles={loadCSVFiles}
                  onLiveReload={(url, secs) => { setLiveReloadUrl(url); setLiveReloadSecs(secs) }}
                  onLiveReloadSecs={liveReloadSecs} />
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
                    {lastUpdatedAt && (() => {
                      const mins = Math.floor((Date.now() - lastUpdatedAt) / 60000)
                      return (
                        <span className="text-[var(--t5)] hidden sm:flex items-center gap-1">
                          · <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] inline-block" />
                          {mins < 1 ? 'just now' : `${mins}m ago`}
                        </span>
                      )
                    })()}
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
              <div className="flex items-center gap-3 pl-1">
                <button onClick={reset}
                  className="text-[11px] text-[var(--t5)] hover:text-[var(--t3)] transition-colors">
                  ← Load different data
                </button>
                {rows.length > 0 && (
                  <button onClick={exportAllData}
                    className="text-[11px] text-[var(--t5)] hover:text-[var(--afg)] transition-colors flex items-center gap-1">
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d="M6 1v7M3.5 5.5L6 8l2.5-2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M1 10h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                    Download all {rows.length.toLocaleString()} rows
                  </button>
                )}
              </div>
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

          {/* Dataset details — collapsible */}
          {dataLoaded && (
            <div className="space-y-3">
              <button
                onClick={() => setShowDatasetDetails(v => !v)}
                className="flex items-center gap-1.5 text-[11px] text-[var(--t4)] hover:text-[var(--t2)] transition-colors group"
              >
                <span className={`transition-transform duration-200 text-[9px] ${showDatasetDetails ? 'rotate-90' : ''}`}>▶</span>
                <span>Dataset details</span>
                {(() => {
                  const hasFilters = Object.values(columnFilters).some(s => s.size > 0)
                  const hasWhere = !!rowFilterExpr.trim()
                  const badges = []
                  if (hasFilters) badges.push('filter')
                  if (hasWhere) badges.push('where')
                  if (undoStack.length > 0) badges.push(`${undoStack.length} undo`)
                  return badges.length > 0 ? (
                    <span className="flex gap-1">
                      {badges.map(b => (
                        <span key={b} className="bg-[#6366f1]/15 text-[var(--afg)] text-[9px] px-1.5 py-0.5 rounded-full font-semibold leading-none">{b}</span>
                      ))}
                    </span>
                  ) : null
                })()}
              </button>

              {showDatasetDetails && (
                <div className="space-y-4">
                  <StatsStrip rows={rows} columns={columns} />

                  {trends && trends.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {trends.map(t => {
                        const up = t.pct >= 0
                        const abs = Math.abs(t.pct)
                        const label = abs >= 1000 ? '>999%' : `${abs.toFixed(1)}%`
                        return (
                          <div key={t.col}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-medium ${
                              up
                                ? 'bg-[#10b981]/8 border-[#10b981]/20 text-[#10b981]'
                                : 'bg-red-400/8 border-red-400/20 text-red-400'
                            }`}>
                            <span>{up ? '▲' : '▼'}</span>
                            <span className="text-[var(--t2)] font-normal">{t.col}</span>
                            <span>{up ? '+' : '-'}{label} vs prev period</span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <DatasetProfile profile={profile} loading={profileLoading} />
                  <AnomalyPanel anomalies={anomalies} loading={anomaliesLoading} />

                  {rows.length > 0 && (() => {
                    const hasFilters = Object.values(columnFilters).some(s => s.size > 0)
                    const filterCount = Object.values(columnFilters).reduce((n, s) => n + s.size, 0)
                    const tbBtn = (active, onClick, children, extra = '') =>
                      <button onClick={onClick}
                        className={`text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-all ${extra} ${
                          active
                            ? 'bg-[#6366f1]/10 text-[var(--afg)]'
                            : 'text-[var(--t4)] hover:text-[var(--t2)] hover:bg-[var(--sf3)]'
                        }`}>
                        {children}
                      </button>
                    const sep = <span className="w-px h-3.5 bg-[var(--ln2)] mx-0.5 shrink-0" />
                    return (
                      <div className="flex items-center gap-0.5 bg-[var(--sf2)] border border-[var(--ln)] rounded-xl px-1.5 py-1.5 w-fit flex-wrap">
                        {tbBtn(showFilterPanel || hasFilters, () => setShowFilterPanel(f => !f),
                          <span className="flex items-center gap-1.5">
                            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                              <path d="M1 2.5h10M3 6h6M5 9.5h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                            Filter
                            {hasFilters && (
                              <span className="bg-[#6366f1] text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold tabular">
                                {filterCount}
                              </span>
                            )}
                          </span>
                        )}
                        {tbBtn(showRowFilter || !!rowFilterExpr.trim(), () => setShowRowFilter(v => !v),
                          <span className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px]">≥</span>
                            Where
                            {rowFilterExpr.trim() && (
                              <span className="bg-[#6366f1] text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold leading-none">on</span>
                            )}
                          </span>
                        )}
                        {tbBtn(showCalcCol, () => setShowCalcCol(c => !c),
                          <span className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px]">ƒ</span>
                            Calc
                          </span>
                        )}
                        {sep}
                        {tbBtn(false, runReport, reportLoading ? '···' : 'Report', reportLoading ? 'opacity-50 cursor-not-allowed' : '')}
                        {tbBtn(false, () => setShowWorkspaces(true),
                          <span className="flex items-center gap-1.5">
                            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                              <rect x="1" y="1" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                              <rect x="6.5" y="1" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                              <rect x="1" y="6.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                              <rect x="6.5" y="6.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                            </svg>
                            Workspaces
                          </span>
                        )}
                        {undoStack.length > 0 && (
                          <>
                            {sep}
                            <button onClick={() => {
                              setUndoStack(prev => {
                                if (!prev.length) return prev
                                const [last, ...rest] = prev
                                setChartConfig(last.config)
                                setChartData(last.data)
                                setChartId(id => id + 1)
                                return rest
                              })
                            }}
                              className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg text-[var(--t4)] hover:text-amber-400 hover:bg-amber-400/8 transition-all flex items-center gap-1.5">
                              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                                <path d="M2 4.5H7.5a3 3 0 010 6H5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                                <path d="M2 4.5L4.5 2M2 4.5L4.5 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              Undo
                            </button>
                          </>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Filter panel */}
          {showFilterPanel && dataLoaded && rows.length > 0 && (
            <FilterPanel
              columns={columns}
              rows={rows}
              filters={columnFilters}
              onFilters={setColumnFilters}
              onClose={() => setShowFilterPanel(false)}
            />
          )}

          {/* Row filter input */}
          {showRowFilter && (
            <div className="space-y-1.5">
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <input type="text" value={rowFilterExpr} onChange={e => setRowFilterExpr(e.target.value)}
                    placeholder="e.g.  sales > 1000  ·  region = West  ·  growth >= 10 and growth <= 30"
                    className="w-full bg-[var(--sf)] border border-[var(--ln2)] rounded-lg px-3 py-2 text-[12px] font-mono text-[var(--t1)] placeholder:text-[var(--t5)] focus:outline-none focus:border-[#6366f1]/50 transition-colors pr-8" />
                  {rowFilterExpr && (
                    <button onClick={() => setRowFilterExpr('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--t4)] hover:text-[var(--t2)] transition-colors text-[11px]">✕</button>
                  )}
                </div>
              </div>
              {rowFilterExpr.trim() && rows.length > 0 && (() => {
                const matched = applyRowFilter(rows, rowFilterExpr).length
                return (
                  <p className="text-[11px] text-[var(--t4)] pl-1">
                    <span className={matched === 0 ? 'text-red-400' : 'text-[var(--afg)]'}>{matched.toLocaleString()}</span>
                    {' '}of {rows.length.toLocaleString()} rows match — AI queries will use only these rows
                  </p>
                )
              })()}
            </div>
          )}

          {/* Calculated column input */}
          {showCalcCol && (
            <div className="flex gap-2 items-center">
              <input type="text" value={calcColExpr} onChange={e => setCalcColExpr(e.target.value)}
                placeholder="e.g. sales * 1.1  or  Math.round(price / qty)"
                onKeyDown={e => e.key === 'Enter' && addCalculatedColumn(calcColExpr)}
                className="flex-1 bg-[var(--sf)] border border-[var(--ln2)] rounded-lg px-3 py-2 text-[12px] font-mono text-[var(--t1)] placeholder:text-[var(--t5)] focus:outline-none focus:border-[#6366f1]/50 transition-colors" />
              <button onClick={() => addCalculatedColumn(calcColExpr)} disabled={!calcColExpr.trim()}
                className="bg-[#6366f1] hover:bg-[#5254cc] disabled:opacity-30 text-white text-[12px] px-4 py-2 rounded-lg transition-colors whitespace-nowrap">
                Add column
              </button>
            </div>
          )}

          {/* Smart Overview — headline + insights + questions, shown before first real query */}
          {dataLoaded && !hasQueried && (overviewLoading || smartOverview) && (
            <SmartOverview
              overview={smartOverview}
              loading={overviewLoading}
              anomalies={anomalies}
              onQuestion={q => { setQuery(q); runQuery(q) }}
              onShowAnomalies={() => setShowDatasetDetails(true)}
            />
          )}

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

          {/* Query bar is now sticky bottom — see below */}

          {/* Error */}
          {error && !loading && (
            <div className="bg-[var(--err-bg)] border border-[var(--err-br)] rounded-xl px-5 py-4 text-[13px] text-[var(--err-fg)] leading-relaxed">
              {error}
            </div>
          )}

          {/* Chart hidden strip */}
          {chartConfig && chartHidden && (
            <div className="flex items-center justify-between bg-[var(--sf2)] border border-[var(--ln)] rounded-xl px-4 py-2.5">
              <span className="text-[12px] text-[var(--t4)] truncate mr-3">{chartConfig.title || 'Chart'}</span>
              <button onClick={() => setChartHidden(false)}
                className="text-[11px] text-[var(--afg)] hover:text-[var(--t1)] transition-colors whitespace-nowrap shrink-0">
                Show chart
              </button>
            </div>
          )}

          {/* Chart card */}
          {chartConfig && !chartHidden && (() => {
            const followUpChips = getFollowUps(chartConfig, columns)
            const hasInsight = chartConfig.answerType !== 'insight' && !!chartConfig.insight
            return (
              <div ref={chartRef} className={`bg-[var(--sf)] border border-[var(--ln)] rounded-2xl overflow-hidden chart-fade-in ${focusMode ? 'ring-2 ring-[#6366f1]/20' : ''}`} style={{ boxShadow: 'var(--shadow-md)' }}>

                {/* ── Header ── */}
                <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4">
                  <div className="min-w-0">
                    {editingTitle ? (
                      <input
                        autoFocus
                        value={titleDraft}
                        onChange={e => setTitleDraft(e.target.value)}
                        onBlur={() => { setChartConfig(c => ({ ...c, title: titleDraft })); setEditingTitle(false) }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { setChartConfig(c => ({ ...c, title: titleDraft })); setEditingTitle(false) }
                          if (e.key === 'Escape') setEditingTitle(false)
                        }}
                        className="text-[15px] font-semibold text-[var(--t1)] bg-transparent border-b-2 border-[#6366f1] focus:outline-none w-full leading-snug"
                      />
                    ) : (
                      <h2
                        onClick={() => { setEditingTitle(true); setTitleDraft(chartConfig.title) }}
                        title="Click to rename"
                        className="text-[15px] font-semibold text-[var(--t1)] leading-snug cursor-text hover:opacity-80 transition-opacity"
                      >
                        {chartConfig.title}
                      </h2>
                    )}
                    {chartConfig.chartType && !focusMode && (
                      <span className="text-[10px] bg-[#6366f1]/10 text-[var(--afg)] px-2 py-0.5 rounded-md mt-1.5 inline-block font-semibold tracking-widest uppercase">
                        {CHART_LABEL[chartConfig.chartType] || chartConfig.chartType}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setChartHidden(true)}
                      title="Hide chart"
                      className="text-[11px] bg-[var(--sf2)] border border-[var(--ln2)] hover:border-[var(--ln3)] text-[var(--t3)] hover:text-[var(--t1)] px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                      Hide
                    </button>
                    <button onClick={shareChart}
                      className="text-[11px] bg-[var(--sf2)] border border-[var(--ln2)] hover:border-[var(--ln3)] text-[var(--t3)] hover:text-[var(--t1)] px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                      {copied ? '✓ Copied' : 'Share'}
                    </button>
                    <button onClick={pinChart} disabled={isPinned()}
                      className={`text-[11px] border px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                        isPinned()
                          ? 'bg-[#6366f1]/10 border-[#6366f1]/25 text-[var(--afg)] cursor-default'
                          : 'bg-[var(--sf2)] border-[var(--ln2)] hover:border-[#6366f1]/35 text-[var(--t3)] hover:text-[var(--afg)]'
                      }`}>
                      {isPinned() ? '✓ Pinned' : 'Pin'}
                    </button>
                    <div className="relative" ref={exportMenuRef}>
                      <button onClick={() => setExportOpen(o => !o)}
                        className="flex items-center gap-1 text-[11px] bg-[var(--sf2)] border border-[var(--ln2)] hover:border-[var(--ln3)] text-[var(--t3)] hover:text-[var(--t1)] px-3 py-1.5 rounded-lg transition-colors">
                        Export <span className="text-[9px] opacity-50">▾</span>
                      </button>
                      {exportOpen && (
                        <div className="absolute right-0 top-full mt-1.5 bg-[var(--sf3)] border border-[var(--ln2)] rounded-xl z-40 py-1.5 min-w-[152px]" style={{ boxShadow: 'var(--shadow-lg)' }}>
                          {[
                            ['PNG image',       () => { exportPNG();       setExportOpen(false) }],
                            ['SVG vector',      () => { exportSVG();       setExportOpen(false) }],
                            ['CSV data',        () => { exportCSV();       setExportOpen(false) }],
                            ['Excel (.xlsx)',   () => { exportXLSX();      setExportOpen(false) }],
                            ['Copy as JSON',    () => { copyDataJSON();    setExportOpen(false) }],
                            ['Copy embed code', () => { copyEmbedCode();   setExportOpen(false) }],
                          ].map(([label, fn]) => (
                            <button key={label} onClick={fn}
                              className="w-full px-3.5 py-2 text-[12px] text-left text-[var(--t3)] hover:text-[var(--t1)] hover:bg-[var(--sf2)] transition-colors">
                              {label}
                            </button>
                          ))}
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

                {/* ── Toolbar + Axis controls (hidden in focus mode) ── */}
                {!focusMode && <>
                <div className="flex items-center gap-2 px-4 py-2 border-y border-[var(--ln)] bg-[var(--sf2)]" style={{ scrollbarWidth: 'none' }}>
                  {/* Chart type dropdown */}
                  <div className="relative shrink-0">
                    <button
                      onClick={() => setChartTypeOpen(o => !o)}
                      className="flex items-center gap-1.5 text-[11px] font-medium bg-[var(--sf)] border border-[var(--ln2)] hover:border-[var(--ln3)] text-[var(--t2)] px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <span className="text-[var(--afg)] font-semibold">{CHART_LABEL[chartConfig.chartType] || chartConfig.chartType}</span>
                      <span className="text-[9px] text-[var(--t4)]">▾</span>
                    </button>
                    {chartTypeOpen && (
                      <div className="absolute left-0 top-full mt-1.5 bg-[var(--sf3)] border border-[var(--ln2)] rounded-xl z-40 py-1.5 grid grid-cols-2 min-w-[140px]" style={{ boxShadow: 'var(--shadow-lg)' }}>
                        {Object.entries(CHART_LABEL).map(([type, label]) => (
                          <button key={type}
                            onClick={() => { switchChartType(type); setChartTypeOpen(false) }}
                            className={`text-left px-3.5 py-1.5 text-[12px] transition-colors ${
                              chartConfig.chartType === type
                                ? 'text-[var(--afg)] font-semibold'
                                : 'text-[var(--t3)] hover:text-[var(--t1)] hover:bg-[var(--sf2)]'
                            }`}>
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right-side controls */}
                  <div className="ml-auto flex items-center gap-1 shrink-0">
                    {/* Overlay toggles */}
                    {['bar','line','area','composed'].includes(chartConfig.chartType) && (
                      <button onClick={() => setShowAvgLine(v => !v)}
                        className={`text-[10px] font-medium px-2 py-1 rounded-md transition-all ${showAvgLine ? 'bg-[#6366f1]/12 text-[var(--afg)]' : 'text-[var(--t4)] hover:text-[var(--t2)] hover:bg-[var(--sf3)]'}`}>
                        Avg
                      </button>
                    )}
                    {['bar','funnel'].includes(chartConfig.chartType) && (
                      <button onClick={() => setShowDataLabels(v => !v)}
                        className={`text-[10px] font-medium px-2 py-1 rounded-md transition-all ${showDataLabels ? 'bg-[#6366f1]/12 text-[var(--afg)]' : 'text-[var(--t4)] hover:text-[var(--t2)] hover:bg-[var(--sf3)]'}`}>
                        Labels
                      </button>
                    )}
                    {['line','area','scatter'].includes(chartConfig.chartType) && (
                      <button onClick={() => setShowTrendLine(v => !v)}
                        className={`text-[10px] font-medium px-2 py-1 rounded-md transition-all ${showTrendLine ? 'bg-[#6366f1]/12 text-[var(--afg)]' : 'text-[var(--t4)] hover:text-[var(--t2)] hover:bg-[var(--sf3)]'}`}>
                        Trend
                      </button>
                    )}
                    {['line','area'].includes(chartConfig.chartType) && (
                      <button onClick={() => setForecastPeriods(f => f > 0 ? 0 : 6)}
                        className={`text-[10px] font-medium px-2 py-1 rounded-md transition-all ${forecastPeriods > 0 ? 'bg-[#6366f1]/12 text-[var(--afg)]' : 'text-[var(--t4)] hover:text-[var(--t2)] hover:bg-[var(--sf3)]'}`}>
                        +6 Fcst
                      </button>
                    )}
                    {chartConfig.chartType === 'bar' &&
                      (chartConfig.groupBy || (Array.isArray(chartConfig.yAxis) && chartConfig.yAxis.length > 1)) && (
                      <button onClick={() => setStackedBar(v => !v)}
                        className={`text-[10px] font-medium px-2 py-1 rounded-md transition-all ${stackedBar ? 'bg-[#6366f1]/12 text-[var(--afg)]' : 'text-[var(--t4)] hover:text-[var(--t2)] hover:bg-[var(--sf3)]'}`}>
                        Stack
                      </button>
                    )}
                    {chartConfig.chartType === 'composed' && (
                      <button onClick={() => setShowDualYAxis(v => !v)}
                        className={`text-[10px] font-medium px-2 py-1 rounded-md transition-all ${showDualYAxis ? 'bg-[#6366f1]/12 text-[var(--afg)]' : 'text-[var(--t4)] hover:text-[var(--t2)] hover:bg-[var(--sf3)]'}`}>
                        Dual Y
                      </button>
                    )}

                    <span className="w-px h-3.5 bg-[var(--ln2)] mx-1 shrink-0" />

                    {/* View toggle */}
                    <div className="flex items-center bg-[var(--sf)] border border-[var(--ln2)] rounded-lg p-0.5">
                      {['chart','table'].map(v => (
                        <button key={v} onClick={() => setChartView(v)}
                          className={`text-[10px] px-2.5 py-1 rounded-md transition-colors capitalize ${
                            chartView === v ? 'bg-[var(--sf3)] text-[var(--t1)]' : 'text-[var(--t4)] hover:text-[var(--t2)]'
                          }`}>
                          {v}
                        </button>
                      ))}
                    </div>

                    <span className="w-px h-3.5 bg-[var(--ln2)] mx-1 shrink-0" />

                    <PalettePicker palette={palette} onPalette={setPalette} />
                    <button onClick={() => runQuery(query)} disabled={loading || !query.trim() || !rows.length}
                      title="Re-run query"
                      className="flex items-center justify-center w-7 h-7 bg-[var(--sf)] border border-[var(--ln2)] hover:border-[var(--ln3)] disabled:opacity-30 text-[var(--t3)] hover:text-[var(--t1)] rounded-lg transition-colors text-[13px]">
                      ↻
                    </button>
                    <button onClick={() => setFullscreen(true)} title="Fullscreen (F)"
                      className="flex items-center justify-center w-7 h-7 bg-[var(--sf)] border border-[var(--ln2)] hover:border-[var(--ln3)] text-[var(--t3)] hover:text-[var(--t1)] rounded-lg transition-colors">
                      <FullscreenIcon />
                    </button>

                    <span className="text-[10px] text-[var(--t5)] ml-1 tabular shrink-0">{chartData.length} pts</span>
                  </div>
                </div>

                {/* ── Axis controls ── */}
                {!['pie','donut','heatmap','scatter','bubble','funnel'].includes(chartConfig.chartType) && (
                  <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--ln)] bg-[var(--sf2)] overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                    {[
                      { label: 'X', field: 'xAxis', opts: columns.map(c => c.name), current: chartConfig.xAxis },
                      { label: 'Y', field: 'yAxis', opts: columns.filter(c => c.type === 'numeric').map(c => c.name), current: Array.isArray(chartConfig.yAxis) ? chartConfig.yAxis[0] : chartConfig.yAxis },
                    ].map(({ label, field, opts, current }) => (
                      <label key={field} className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-semibold text-[var(--t5)] uppercase tracking-wider w-3">{label}</span>
                        <select
                          value={current || ''}
                          onChange={e => updateAxis(field, e.target.value)}
                          className="bg-[var(--sf)] border border-[var(--ln2)] hover:border-[var(--ln3)] rounded-lg px-2 py-1 text-[11px] text-[var(--t2)] focus:outline-none cursor-pointer transition-colors max-w-[140px] truncate"
                        >
                          {opts.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </label>
                    ))}
                    <label className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-semibold text-[var(--t5)] uppercase tracking-wider">Group</span>
                      <select
                        value={chartConfig.groupBy || ''}
                        onChange={e => updateAxis('groupBy', e.target.value || null)}
                        className="bg-[var(--sf)] border border-[var(--ln2)] hover:border-[var(--ln3)] rounded-lg px-2 py-1 text-[11px] text-[var(--t2)] focus:outline-none cursor-pointer transition-colors max-w-[120px]"
                      >
                        <option value="">None</option>
                        {columns.filter(c => c.type === 'categorical').map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                      </select>
                    </label>
                    <label className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-semibold text-[var(--t5)] uppercase tracking-wider">Agg</span>
                      <select
                        value={chartConfig.aggregation || 'none'}
                        onChange={e => updateAxis('aggregation', e.target.value)}
                        className="bg-[var(--sf)] border border-[var(--ln2)] hover:border-[var(--ln3)] rounded-lg px-2 py-1 text-[11px] text-[var(--t2)] focus:outline-none cursor-pointer transition-colors"
                      >
                        {['sum','avg','count','none'].map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </label>
                  </div>
                )}
                </>}

                {/* Sampled notice */}
                {sampledNotice && (
                  <div className="mx-5 mt-4 text-[11px] text-[var(--t4)] bg-[var(--sf2)] border border-[var(--ln)] rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                    <span className="text-[var(--afg)] text-[10px]">↓</span>
                    Showing {sampledNotice.shown.toLocaleString()} of {sampledNotice.total.toLocaleString()} points
                  </div>
                )}

                {/* ── Chart body ── */}
                <div className="px-5 py-5">
                  {loading ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#6366f1] animate-pulse shrink-0" />
                        <span className="text-[12px] text-[var(--t3)]">{loadingMsg || 'Analyzing your data…'}</span>
                      </div>
                      {streamingText ? (
                        <div className="relative bg-[var(--sf2)] border border-[var(--ln)] rounded-xl px-4 py-3 min-h-[120px] max-h-[280px] overflow-y-auto">
                          <p className="text-[10px] text-[var(--t5)] uppercase tracking-widest font-semibold mb-2">Live output</p>
                          <pre className="text-[11px] text-[var(--t3)] font-mono whitespace-pre-wrap break-all leading-relaxed">{streamingText}<span className="inline-block w-[2px] h-[13px] bg-[#6366f1] ml-0.5 align-text-bottom animate-pulse" /></pre>
                        </div>
                      ) : (
                        <div className="h-[360px] bg-[var(--sf2)] rounded-xl animate-pulse" />
                      )}
                    </div>
                  ) : chartConfig.answerType === 'insight' ? (
                    <div className="bg-[#6366f1]/5 border border-[#6366f1]/12 rounded-xl px-5 py-5">
                      <p className="text-[10px] font-semibold text-[var(--afg)] uppercase tracking-widest mb-2.5">Answer</p>
                      <p className="text-[15px] text-[var(--t1)] leading-relaxed font-medium">{chartConfig.answer}</p>
                    </div>
                  ) : chartView === 'chart' ? (
                    <ChartErrorBoundary key={chartId}>
                      <ChartRenderer config={chartConfig} data={chartData} columns={columns} colors={activeColors}
                        showAvgLine={showAvgLine} showDataLabels={showDataLabels} showTrendLine={showTrendLine}
                        forecastPeriods={forecastPeriods} showDualYAxis={showDualYAxis} stackedBar={stackedBar} />
                    </ChartErrorBoundary>
                  ) : (
                    <DataTable data={chartData} />
                  )}
                </div>

                {/* ── Footer — insight + follow-ups ── */}
                <div className="border-t border-[var(--ln)] bg-[var(--sf2)]">
                  {hasInsight && (
                    <div className="px-5 pt-4 pb-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className="w-1 h-1 rounded-full bg-[var(--afg)] shrink-0" />
                            <p className="text-[10px] font-semibold text-[var(--afg)] uppercase tracking-widest">Insight</p>
                          </div>
                          <p className="text-[12px] text-[var(--t2)] leading-relaxed"><FormatInsight text={chartConfig.insight} /></p>
                          {(explanation || explanationLoading) && (
                            <p className="text-[12px] text-[var(--t3)] leading-relaxed mt-2 pl-3 border-l-2 border-[#6366f1]/20">
                              {explanationLoading ? <span className="animate-pulse">Explaining…</span> : explanation}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <button onClick={() => { const next = !eli5Mode; setEli5Mode(next); runExplain(next) }}
                            disabled={explanationLoading}
                            title={eli5Mode ? 'Switch to analyst mode' : 'Explain Like I\'m 5'}
                            className={`text-[10px] font-medium px-2.5 py-1.5 rounded-lg border transition-all whitespace-nowrap disabled:opacity-40 ${
                              eli5Mode
                                ? 'bg-[#f59e0b]/10 border-[#f59e0b]/30 text-[#f59e0b]'
                                : 'border-[var(--ln2)] hover:border-[#6366f1]/35 text-[var(--t4)] hover:text-[var(--afg)]'
                            }`}>
                            {eli5Mode ? '🧒 ELI5' : '✦ Explain'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Explanation for charts that have no separate insight field */}
                  {!hasInsight && (explanation || explanationLoading) && chartConfig.answerType !== 'insight' && (
                    <div className="mx-5 mb-0 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="w-1 h-1 rounded-full bg-[var(--afg)] shrink-0" />
                          <p className="text-[10px] font-semibold text-[var(--afg)] uppercase tracking-widest">Explanation</p>
                        </div>
                        <p className="text-[12px] text-[var(--t3)] leading-relaxed">
                          {explanationLoading ? <span className="animate-pulse">Analyzing…</span> : explanation}
                        </p>
                      </div>
                      <button onClick={() => { const next = !eli5Mode; setEli5Mode(next); runExplain(next) }}
                        disabled={explanationLoading}
                        className={`shrink-0 text-[10px] font-medium px-2.5 py-1.5 rounded-lg border transition-all whitespace-nowrap disabled:opacity-40 ${
                          eli5Mode ? 'bg-[#f59e0b]/10 border-[#f59e0b]/30 text-[#f59e0b]' : 'border-[var(--ln2)] hover:border-[#6366f1]/35 text-[var(--t4)] hover:text-[var(--afg)]'
                        }`}>
                        {eli5Mode ? '🧒 ELI5' : '✦ ELI5'}
                      </button>
                    </div>
                  )}
                  {!focusMode && (
                    <div className={`px-5 pb-4 space-y-2.5 ${hasInsight || (!hasInsight && (explanation || explanationLoading)) ? 'border-t border-[var(--ln)] pt-3 mt-4' : 'pt-4'}`}>
                      {followUpChips.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {followUpChips.map(q => (
                            <button key={q} onClick={() => { setFollowUp(q); runQuery(q) }}
                              className="text-[11px] bg-[#6366f1]/5 border border-[#6366f1]/15 hover:border-[#6366f1]/30 text-[var(--afg)] hover:bg-[#6366f1]/10 px-3 py-1 rounded-full transition-colors">
                              {q}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Ask a follow-up…"
                          value={followUp}
                          onChange={e => setFollowUp(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && followUp.trim()) { runQuery(followUp); setFollowUp('') } }}
                          className="flex-1 bg-[var(--sf)] border border-[var(--ln2)] focus:border-[#6366f1]/40 rounded-xl px-4 py-2 text-[12px] text-[var(--t1)] placeholder:text-[var(--t4)] focus:outline-none transition-colors"
                        />
                        <button onClick={() => { if (followUp.trim()) { runQuery(followUp); setFollowUp('') } }}
                          disabled={!followUp.trim()}
                          className="text-[12px] bg-[var(--sf)] border border-[var(--ln2)] hover:border-[var(--ln3)] disabled:opacity-30 text-[var(--t3)] hover:text-[var(--t1)] px-4 py-2 rounded-xl transition-colors whitespace-nowrap">
                          Ask
                        </button>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )
          })()}

          {/* History strip */}
          {dataLoaded && (
            <HistoryStrip chartHistory={chartHistory} onRestore={restoreHistory} />
          )}

        </main>
      )}

      {/* Sticky bottom query bar — visible when data is loaded in explore view */}
      {view === 'explore' && dataLoaded && (
        <>
          {/* Dim backdrop when input is focused */}
          {queryFocused && (
            <div
              className="fixed inset-0 z-20 bg-[var(--bg)]/70 backdrop-blur-[3px]"
              onMouseDown={() => {
                setQueryFocused(false)
                setFocusMode(false)
                queryInputRef.current?.blur()
              }}
            />
          )}

          <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--ln)] bg-[var(--bg)]/95 backdrop-blur-md">
            <div className="max-w-4xl mx-auto px-6 py-3 space-y-2">

              {/* ── Expanded suggestion cards (input focused) ── */}
              {queryFocused && (
                <div className="space-y-1.5 pb-1">
                  {suggestionsLoading && !suggestions.length
                    ? [1, 2, 3, 4].map(i => (
                        <div key={i} className="h-[42px] bg-[var(--sf2)] rounded-2xl animate-pulse" />
                      ))
                    : (suggestions.length ? suggestions : CHIPS).map(chip => (
                        <button
                          key={chip}
                          onMouseDown={e => {
                            e.preventDefault() // keep input focused long enough to register click
                            setQuery(chip)
                            setQueryFocused(false)
                            setFocusMode(false)
                            runQuery(chip)
                          }}
                          className="w-full text-left px-4 py-[11px] text-[13px] text-[var(--t2)] bg-[var(--sf)] border border-[var(--ln)] hover:border-[#6366f1]/35 hover:text-[var(--t1)] rounded-2xl transition-all leading-snug"
                        >
                          {chip}
                        </button>
                      ))
                  }
                </div>
              )}

              {/* ── Compact chips (idle, not focused, not in focus-mode) ── */}
              {!queryFocused && !focusMode && (
                <div className="flex flex-wrap gap-1.5 items-center">
                  {suggestionsLoading && !suggestions.length
                    ? CHIPS.slice(0, 4).map(chip => (
                        <div key={chip}
                          className="h-[24px] rounded-full bg-[var(--sf)] border border-[var(--ln)] animate-pulse"
                          style={{ width: `${chip.length * 6.2 + 20}px` }} />
                      ))
                    : (suggestions.length ? suggestions : CHIPS).slice(0, 5).map(chip => (
                        <button key={chip} onClick={() => { setQuery(chip); runQuery(chip) }}
                          className="text-[11px] bg-[var(--sf)] border border-[var(--ln)] hover:border-[var(--ln3)] text-[var(--t3)] hover:text-[var(--t1)] px-3 py-1 rounded-full transition-all whitespace-nowrap">
                          {chip}
                        </button>
                      ))
                  }
                </div>
              )}

              {/* ── Input row ── */}
              <div className="relative flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    ref={queryInputRef}
                    type="text"
                    placeholder="Ask anything about your data…"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onFocus={() => { setQueryFocused(true); setFocusMode(true) }}
                    onBlur={() => setTimeout(() => { setQueryFocused(false); setFocusMode(false) }, 150)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !rateLimitLeft) {
                        runQuery(query)
                        setQueryFocused(false)
                        setFocusMode(false)
                        e.currentTarget.blur()
                      }
                      if (e.key === 'Escape') {
                        setQueryFocused(false)
                        setFocusMode(false)
                        e.currentTarget.blur()
                      }
                    }}
                    className="query-input w-full bg-[var(--sf)] border border-[var(--ln2)] rounded-2xl px-5 py-[13px] text-[14px] text-[var(--t1)] placeholder:text-[var(--t4)] focus:outline-none pr-24 transition-colors focus:border-[#6366f1]/50"
                  />
                  {query && !loading && (
                    <button
                      onMouseDown={e => { e.preventDefault(); setQuery('') }}
                      className="absolute right-[5rem] top-1/2 -translate-y-1/2 text-[var(--t4)] hover:text-[var(--t2)] transition-colors p-1.5 rounded-lg hover:bg-[var(--sf2)]">
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </button>
                  )}
                  <button
                    onMouseDown={e => {
                      e.preventDefault()
                      runQuery(query)
                      setQueryFocused(false)
                      setFocusMode(false)
                    }}
                    disabled={loading || !query.trim() || rateLimitLeft > 0}
                    title={rateLimitLeft > 0 ? `Rate limited — ${rateLimitLeft}s remaining` : undefined}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-[#6366f1] hover:bg-[#5254cc] disabled:opacity-20 disabled:cursor-not-allowed text-white text-[12px] font-semibold px-4 py-1.5 rounded-xl transition-all"
                  >
                    {loading ? '···' : 'Ask'}
                  </button>
                </div>
                <span className="text-[10px] text-[var(--t5)] hidden sm:block tabular shrink-0">⌘K</span>
              </div>

            </div>
          </div>
        </>
      )}
    </div>
  )
}
