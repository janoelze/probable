import { Sparkline, SPARK_COLORS } from '../../src/index'
import type { DemoContext } from '../main'
import { sparkValues } from '../data'

export default function (el: HTMLElement, ctx: DemoContext) {
  el.innerHTML = `<div class="mid-cards">
    <div class="mcard"><div class="t">District 7</div><div class="s" style="color:${SPARK_COLORS.blue}">64% Avery Lin</div>
      <div class="spark" data-k="a"></div><div class="f"><span>$6M Vol</span><span>+1%</span></div></div>
    <div class="mcard wide"><div class="t">Measure 12 passes?</div><div class="s" style="color:${SPARK_COLORS.red}">74% chance no</div>
      <div class="spark" data-k="b"></div><div class="f"><span>$16K Vol</span><span>-10.5%</span></div></div></div>`
  // Cards: y from min(data, floor) to 100%. Favourite race → floor 0.5; yes/no → floor 0 with a 50% line.
  ctx.track(new Sparkline(el.querySelector('[data-k=a]')!, { data: sparkValues(4, 0.6, 0.0005), color: SPARK_COLORS.blue, theme: ctx.theme }))
  ctx.track(new Sparkline(el.querySelector('[data-k=b]')!, { data: sparkValues(9, 0.45, -0.002), color: SPARK_COLORS.red, floor: 0, midline: true, theme: ctx.theme }))
}
