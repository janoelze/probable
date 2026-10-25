import { ProbabilityChart } from '../../src/index'
import type { DemoContext } from '../main'
import { yesNo } from '../data'

export default function (el: HTMLElement, ctx: DemoContext) {
  // One series: no legend, y axis zoomed to the data, pill on hover.
  const chart = ctx.track(new ProbabilityChart(el, { theme: ctx.theme, height: 272 }))
  chart.setSeries(yesNo())
}
