import { ProbabilityChart } from '../../src/index'
import type { DemoContext } from '../main'
import { mayorRace } from '../data'

export default function (el: HTMLElement, ctx: DemoContext) {
  // Two series → names and values sit at the end of each line.
  const chart = ctx.track(new ProbabilityChart(el, { theme: ctx.theme, attribution: 'Source: placeholder data' }))
  chart.setSeries(mayorRace())
}
