import { ProbabilityChart } from '../../src/index'
import type { DemoContext } from '../main'
import { game } from '../data'

export default function (el: HTMLElement, ctx: DemoContext) {
  // Long names wrap onto two lines in a shared column (max 112px).
  el.style.width = '684px'
  const chart = ctx.track(new ProbabilityChart(el, { theme: ctx.theme, height: 200, labels: 'end', labelMaxWidth: 112 }))
  chart.setSeries(game())
}
