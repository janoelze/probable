import { ProbabilityChart } from '../../src/index'
import type { DemoContext } from '../main'
import { mayorRace } from '../data'

export default function (el: HTMLElement, ctx: DemoContext) {
  // Every color is a CSS variable; --pb-chart-bg tells labels, pills and the
  // dashed backfill what they sit on.
  el.style.cssText += ';background:#101a2e;border-radius:12px;padding:20px 16px 8px'
  el.style.setProperty('--pb-chart-bg', '#101a2e')
  el.style.setProperty('--pb-content-secondary', '#8fa3c7')
  el.style.setProperty('--pb-gray-400', '#2a3b5c')
  el.style.setProperty('--pb-gray-100', '#1b2842')
  const chart = new ProbabilityChart(el, { theme: 'dark', strokeWidth: 2, attribution: 'Source: your data' })
  ctx.track({ setOptions() {}, destroy: () => chart.destroy() }) // stays dark
  chart.setSeries(mayorRace().map((s, i) => ({ ...s, color: ['#3ee6b0', '#ff7a6b'][i] })))
}
