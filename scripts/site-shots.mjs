// Screenshots every docs page and reports console errors.
//   node scripts/site-shots.mjs [baseUrl] [page ...]
import { chromium } from 'playwright'

const base = process.argv[2]?.startsWith('http') ? process.argv[2] : 'http://127.0.0.1:5199/'
const only = process.argv.slice(2).filter((a) => !a.startsWith('http'))
const pages = only.length ? only : ['overview', 'end-labels', 'legend', 'single', 'wrapped-labels', 'number', 'gradient', 'area', 'compact', 'custom-data', 'theming', 'playground', 'live', 'sparkline', 'gauge', 'api-chart', 'api-helpers']
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', (e) => errs.push(`[${p.url()}] ${e}`))
p.on('console', (m) => m.type() === 'error' && errs.push(`[${p.url()}] ${m.text()}`))
for (const id of pages) {
  await p.goto(`${base}#/${id}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(5000)
  await p.screenshot({ path: `.compare/site/${id}.png`, fullPage: true })
  const status = await p.$$eval('.status', (els) => els.map((e) => e.textContent).filter(Boolean))
  console.log(id, status.length ? status : '')
}
console.log('errors', errs)
await b.close()
