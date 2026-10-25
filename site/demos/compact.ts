import { ProbabilityChart } from '../../src/index'
import type { DemoContext } from '../main'
import { game } from '../data'

export default function (el: HTMLElement, ctx: DemoContext) {
  // Card size: 496px wide, short time labels ("4pm 6pm").
  el.style.width = '496px'
  const chart = ctx.track(new ProbabilityChart(el, { theme: ctx.theme, compactTimeAxis: true, labelMaxWidth: 112 }))
  chart.setSeries(game())
}
