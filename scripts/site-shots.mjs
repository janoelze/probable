// Screenshots docs pages and reports console errors.
//   node scripts/site-shots.mjs [baseUrl] [--dark] [page ...]
import { chromium } from 'playwright'

const args = process.argv.slice(2)
const base = args.find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:5199/'
const dark = args.includes('--dark')
const only = args.filter((a) => !a.startsWith('http') && !a.startsWith('--'))
const pages = only.length ? only : ['overview', 'end-labels', 'legend', 'single', 'wrapped-labels', 'number', 'stacked', 'annotations', 'gradient', 'area', 'compact', 'custom-data', 'theming', 'playground', 'live', 'outcome-bars', 'sparkline', 'gauge', 'api-chart', 'api-helpers']
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: dark ? 'dark' : 'light' })
await ctx.addInitScript((d) => { try { localStorage.setItem('probable-docs-theme', d ? 'dark' : 'light') } catch {} }, dark)
const p = await ctx.newPage()
const errs = []
p.on('pageerror', (e) => errs.push(`[${p.url()}] ${e}`))
p.on('console', (m) => m.type() === 'error' && errs.push(`[${p.url()}] ${m.text()}`))
for (const id of pages) {
  await p.goto(`${base}#/${id}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(4000)
  await p.screenshot({ path: `.compare/site/${id}${dark ? '-dark' : ''}.png`, fullPage: true })
  const status = await p.$$eval('.status', (els) => els.map((e) => e.textContent).filter(Boolean))
  console.log(id, status.length ? status : '')
}
console.log('errors', errs)
await b.close()
