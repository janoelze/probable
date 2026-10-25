import { Sparkline, SPARK_COLORS } from '../../src/index'
import type { DemoContext } from '../main'
import { sparkValues } from '../data'

export default function (el: HTMLElement, ctx: DemoContext) {
  el.style.width = '100%'
  el.innerHTML = `<div class="mrow"><b>District 7</b><span>Northfield</span><span>64% Lin</span><span>Lean Lin</span><div class="cell"></div></div>`
  // Table rows: 40px, centred on the last value, no pulse; colored on hover.
  const spark = ctx.track(new Sparkline(el.querySelector('.cell')!, { data: sparkValues(4, 0.6, 0.0005), height: 40, color: 'currentColor', scale: 'centered', pulse: false, theme: ctx.theme }))
  const row = el.querySelector<HTMLElement>('.mrow')!
  row.onmouseenter = () => { spark.setOptions({ color: SPARK_COLORS.blue }); spark.retrace() }
  row.onmouseleave = () => spark.setOptions({ color: 'currentColor' })
}
