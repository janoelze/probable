import { Sparkline, SPARK_COLORS, formatPercent } from '../../src/index'
import type { DemoContext } from '../main'
import { sparkValues } from '../data'

export default function (el: HTMLElement, ctx: DemoContext) {
  const data = sparkValues(4, 0.6, 0.0005)
  const now = Date.now()
  const labels = data.map((_, i) => new Date(now - (data.length - 1 - i) * 3 * 3600e3).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' }))
  el.style.cssText += ';width:360px;height:100px'
  // Scrub along the line to read values; labels show under the cursor.
  ctx.track(new Sparkline(el, {
    data,
    color: SPARK_COLORS.blue,
    appearance: 'widget',
    scale: 'centered',
    rightInset: 0,
    hoverLabels: labels,
    theme: ctx.theme,
    onHover: (v, i) => ctx.status(v == null ? 'Hover the line' : `${labels[i]} · ${formatPercent(v, 1)}`),
  }))
  ctx.status('Hover the line')
}
