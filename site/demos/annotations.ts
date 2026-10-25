import { ProbabilityChart, type Annotation } from '../../src/index'
import type { DemoContext } from '../main'
import { mayorRace } from '../data'

export default function (el: HTMLElement, ctx: DemoContext) {
  const day = 86400
  const now = Math.floor(Date.now() / 1000)
  const annotations: Annotation[] = [
    { time: now - 250 * day, title: 'Campaign launch', description: 'Lin announces her run at the harbour market.' },
    { time: now - 160 * day, title: 'First debate' },
    { time: now - 157 * day, title: 'Debate poll', description: 'Snap poll gives Reyes a narrow win.' },
    { time: now - 90 * day, title: 'Endorsement', description: 'The Northfield Ledger endorses Reyes.', color: 'var(--pb-down)' },
    { time: now - 20 * day, title: 'Early voting opens' },
  ]
  // Markers sit on the time axis; close ones merge. Hover a marker, or move
  // the crosshair over one, to open its card.
  const chart = ctx.track(new ProbabilityChart(el, { theme: ctx.theme, annotations }))
  chart.setSeries(mayorRace())
}
