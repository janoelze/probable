import { ProbabilityChart } from '../../src/index'
import type { DemoContext } from '../main'
import { mayorRace } from '../data'

export default function (el: HTMLElement, ctx: DemoContext) {
  // A soft fill under each line; it is clipped at the cursor with the line.
  const chart = ctx.track(new ProbabilityChart(el, { theme: ctx.theme, area: 0.12 }))
  chart.setSeries(mayorRace())
}
