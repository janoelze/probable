import { ProbabilityChart } from '../../src/index'
import type { DemoContext } from '../main'
import { rising } from '../data'

export default function (el: HTMLElement, ctx: DemoContext) {
  // The stroke fades from startColor (50%) at the bottom to the color of the
  // current value; the end dot and hover pill take the color of their value.
  const chart = ctx.track(new ProbabilityChart(el, { theme: ctx.theme, height: 272, startColor: '#FF5952', endColor: '#27AE60' }))
  chart.setSeries(rising())
}
