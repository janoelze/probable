import { OutcomeBars, type Outcome } from '../../src/index'
import type { DemoContext } from '../main'

export default function (el: HTMLElement, ctx: DemoContext) {
  el.style.width = '420px'
  let items: Outcome[] = [
    { id: 'hold', label: 'Hold', value: 0.47, change: 0.06 },
    { id: 'cut25', label: 'Cut 25 bps', value: 0.32, change: -0.03 },
    { id: 'cut50', label: 'Cut 50 bps', value: 0.14, change: -0.02 },
    { id: 'hike', label: 'Hike 25 bps', value: 0.05, change: 0.01 },
    { id: 'cut75', label: 'Cut 75 bps', value: 0.008 },
  ]
  // Colors follow rank unless an item sets its own.
  const bars = ctx.track(new OutcomeBars(el, { items, theme: ctx.theme }))

  // Simulated updates: rows glide to their new rank, bars and numbers tween.
  const timer = setInterval(() => {
    items = items.map((it) => {
      const value = Math.max(0.002, it.value + (Math.random() - 0.5) * 0.12)
      return { ...it, value, change: value - it.value }
    })
    const total = items.reduce((s, i) => s + i.value, 0)
    bars.setItems(items.map((i) => ({ ...i, value: i.value / total })))
  }, 2500)
  ctx.track({ setOptions() {}, destroy: () => clearInterval(timer) })
}
