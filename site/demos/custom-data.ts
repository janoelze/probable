import { ProbabilityChart } from '../../src/index'
import type { DemoContext } from '../main'

export default function (el: HTMLElement, ctx: DemoContext) {
  const now = Math.floor(Date.now() / 1000)
  const day = 86400
  // time: unix seconds, value: 0..1. Colors: palette keys, hex or any CSS color.
  const series = [
    { id: 'yes', label: 'Yes', color: 'blue', decimals: 1, data: [
      { time: now - 30 * day, value: 0.42 },
      { time: now - 20 * day, value: 0.47 },
      { time: now - 12 * day, value: 0.39 },
      { time: now - 5 * day, value: 0.55 },
      { time: now, value: 0.61 },
    ] },
  ]
  const chart = ctx.track(new ProbabilityChart(el, { theme: ctx.theme, height: 220 }))
  chart.setSeries(series)
}
