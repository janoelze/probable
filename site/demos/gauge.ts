import { Gauge } from '../../src/index'
import type { DemoContext } from '../main'

export default function (el: HTMLElement, ctx: DemoContext) {
  el.style.cssText += ';display:flex;gap:40px;align-items:flex-start'
  // A 200° arc: value from the left, a 6° gap, the rest in gray.
  for (const v of [0.12, 0.5, 0.56, 0.93]) {
    const box = el.appendChild(document.createElement('div'))
    ctx.track(new Gauge(box, { value: v, label: `${Math.round(v * 100)}%`, theme: ctx.theme }))
  }
  const box = el.appendChild(document.createElement('div'))
  ctx.track(new Gauge(box, { value: 0.71, label: '71% Down', color: 'var(--pb-down)', theme: ctx.theme }))
}
