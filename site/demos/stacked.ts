import { ProbabilityChart } from '../../src/index'
import type { DemoContext } from '../main'
import { rateDecision } from '../data'

export default function (el: HTMLElement, ctx: DemoContext) {
  // Mutually exclusive outcomes as bands that always add up to 100%.
  // Pills and labels show each outcome's share; `area` sets band opacity.
  const chart = ctx.track(new ProbabilityChart(el, { theme: ctx.theme, stacked: true, area: 0.22 }))
  chart.setSeries(rateDecision())
}
