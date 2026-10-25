import { LiveChart } from '../../src/index'
import type { DemoContext } from '../main'
import { priceFeed } from '../data'

export default function (el: HTMLElement, ctx: DemoContext) {
  const feed = priceFeed(3120, 7)
  const chart = ctx.track(new LiveChart(el, { theme: ctx.theme, color: '#637FEB', minRange: 0.8, decimals: 2, height: 200 }))
  chart.setData(feed.history(40).map((p) => ({ ...p, value: 3120 + (p.value - 3120) / 20 })))
  // A target outside the visible range is pinned to the edge, with chevrons.
  chart.setTarget(3190)
  const timer = setInterval(() => chart.push(3120 + (feed.next() - 3120) / 20), 1000)
  ctx.track({ setOptions() {}, destroy: () => clearInterval(timer) })
}
