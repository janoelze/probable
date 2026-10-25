import { ProbabilityChart } from '../../src/index'
import type { DemoContext } from '../main'
import { forecast } from '../data'

export default function (el: HTMLElement, ctx: DemoContext) {
  // Not a probability: plain numbers, a unit, and a summary header with the change.
  const chart = ctx.track(new ProbabilityChart(el, { theme: ctx.theme, valueFormat: 'number', unit: 'tickets' }))
  chart.setSeries(forecast())
}
