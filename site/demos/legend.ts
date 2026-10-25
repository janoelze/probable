import { ProbabilityChart, type Series } from '../../src/index'
import type { DemoContext } from '../main'
import { rateDecision } from '../data'

const SPAN: Record<string, number> = { '1w': 7, '1m': 30, '3m': 90, all: Infinity }

export default function (el: HTMLElement, ctx: DemoContext) {
  const all = rateDecision()
  // Windows are just UI: slice (or fetch) the matching data in onWindowChange.
  const slice = (key: string): Series[] => {
    const from = Date.now() / 1000 - SPAN[key] * 86400
    return all.map((s) => ({ ...s, data: s.data.filter((p) => p.time >= from) }))
  }
  const chart = ctx.track(
    new ProbabilityChart(el, {
      theme: ctx.theme,
      timeWindows: true,
      windows: [{ key: '1w', label: '1W' }, { key: '1m', label: '1M' }, { key: '3m', label: '3M' }, { key: 'all', label: 'ALL' }],
      onWindowChange: (key) => chart.setSeries(slice(key)),
    }),
  )
  chart.setSeries(slice('all'))
}
