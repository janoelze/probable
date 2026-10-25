import { LiveChart } from '../../src/index'
import type { DemoContext } from '../main'
import { priceFeed } from '../data'

export default function (el: HTMLElement, ctx: DemoContext) {
  const feed = priceFeed()
  const chart = ctx.track(new LiveChart(el, { theme: ctx.theme, color: '#FF9900', minRange: 20 }))
  chart.setData(feed.history(40))
  chart.setTarget(feed.next() - 6) // e.g. the price at the start of the round
  // Push a value whenever one arrives (websocket, polling, …).
  const timer = setInterval(() => chart.push(feed.next()), 1000)
  ctx.track({ setOptions() {}, destroy: () => clearInterval(timer) })
}
