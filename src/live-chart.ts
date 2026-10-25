// LiveChart: a streaming price line that scrolls in real time. Each new value
// glides in over one second; the y axis rescales every frame; an optional
// target line shows a reference price ("price to beat").

import { scaleLinear } from 'd3-scale'
import { injectStyles, resolveColor, watchTheme, type ThemeName, type ThemeOption } from './theme'
import { formatDate, measureText } from './format'
import { ease } from './motion'
import type { Point } from './data'

export interface LiveChartOptions {
  /** Line, area and head color (any CSS color or palette key). */
  color?: string
  /** Height of the price pane in px; the time axis adds 28px. */
  height?: number
  /** Light, dark or auto. */
  theme?: ThemeOption
  /** Horizontal speed; with the head 88px from the right this sets the visible window. */
  pxPerSecond?: number
  /** Distance of the live head from the right edge, in px. */
  headGap?: number
  /** Smallest y range, so a flat price does not look jagged. */
  minRange?: number
  /** Decimals for the price labels on the right. */
  decimals?: number
  /** Reference value drawn as a dashed line with a pill; `null` hides it. */
  target?: number | null
  /** Pill text for the target line. */
  targetLabel?: string
  /** Fill under the line (5% at the top of the pane, fading out). */
  area?: boolean
  /** Dashed line at the current value. */
  priceLine?: boolean
  /** Ring animation around the live head. */
  pulse?: boolean
  /** Crosshair + value label on hover. */
  interactive?: boolean
  /** How long a new value takes to glide in (ms). */
  glideMs?: number
  /** Price label formatter (axis); default `$80,750`. */
  formatValue?: (v: number, decimals: number) => string
  /** Tooltip value formatter; default `$80,739.77`. */
  formatTooltipValue?: (v: number) => string
}

export const LIVE_CHART_DEFAULTS = {
  color: '#FF9900',
  height: 260,
  theme: 'light' as ThemeOption,
  pxPerSecond: 15,
  headGap: 88,
  minRange: 20,
  decimals: 0,
  target: null as number | null,
  targetLabel: 'Target',
  area: true,
  priceLine: true,
  pulse: true,
  interactive: true,
  glideMs: 1000,
}

const AXIS_H = 28
const SVG = 'http://www.w3.org/2000/svg'
const s = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, parent?: Element) => {
  const el = document.createElementNS(SVG, tag)
  for (const k in attrs) el.setAttribute(k, String(attrs[k]))
  parent?.appendChild(el)
  return el
}
const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2)
const FONT = { fontSize: 11, fontFamily: 'Inter, sans-serif' }
/** `$80,750` / `$80,739.77`: full digits, fixed decimals. */
const money = (v: number, d: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`

/** Axis step: nice multiple of span/7 (1, 2, 2.5, 5, 10 × 10^n), at least 10^-decimals. */
function priceStep(span: number, decimals: number): number {
  const raw = span / 7
  if (raw <= 0) return 10 ** -decimals
  const mag = 10 ** Math.floor(Math.log10(raw))
  const n = raw / mag
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10
  return Math.max(nice * mag, 10 ** -decimals)
}

export class LiveChart {
  readonly el: HTMLElement
  private o: typeof LIVE_CHART_DEFAULTS & Pick<LiveChartOptions, 'formatValue' | 'formatTooltipValue'>
  private theme: ThemeName
  private stopTheme: () => void
  private root: HTMLDivElement
  private svg: SVGSVGElement
  private defs: SVGDefsElement
  private gGrid: SVGGElement
  private areaPath: SVGPathElement
  private linePath: SVGPathElement
  private priceLineEl: SVGLineElement
  private gLabels: SVGGElement
  private gTarget: SVGGElement
  private gHead: SVGGElement
  private gAxis: SVGGElement
  private hoverBar: SVGLineElement
  private hoverDot: SVGCircleElement
  private tip: HTMLDivElement
  private uid = `pbl${Math.random().toString(36).slice(2, 8)}`
  /** Settled points (unix seconds). */
  private points: Point[] = []
  private glide: { from: number; to: number; start: number } | null = null
  private width = 0
  private frame = 0
  private ro: ResizeObserver | null = null
  private hoverX: number | null = null
  private pinnedSince = 0
  private pinned: 'above' | 'below' | null = null

  /** Renders into `el` and starts the animation loop (stopped by `destroy()`). */
  constructor(el: HTMLElement, options: LiveChartOptions = {}) {
    injectStyles(el.ownerDocument)
    this.el = el
    this.o = { ...LIVE_CHART_DEFAULTS, ...options }
    const t = watchTheme(this.o.theme, (th) => (this.theme = th, this.root.dataset.pbTheme = th))
    this.theme = t.theme
    this.stopTheme = t.stop
    this.root = document.createElement('div')
    this.root.className = 'pb-root pb-live'
    this.root.dataset.pbTheme = this.theme
    el.appendChild(this.root)
    this.svg = s('svg', {}, this.root)
    this.svg.style.cssText = 'display:block;overflow:visible'
    this.defs = s('defs', {}, this.svg)
    this.gGrid = s('g', {}, this.svg)
    this.areaPath = s('path', { stroke: 'none' }, this.svg)
    this.linePath = s('path', { fill: 'none', 'stroke-width': 2, 'stroke-linejoin': 'round' }, this.svg)
    this.priceLineEl = s('line', { 'stroke-width': 1, 'stroke-dasharray': '6 6' }, this.svg)
    this.gLabels = s('g', {}, this.svg)
    this.gTarget = s('g', {}, this.svg)
    this.hoverBar = s('line', { 'stroke-width': 1.5 }, this.svg)
    this.hoverBar.style.stroke = 'var(--pb-live-guide)'
    this.gHead = s('g', {}, this.svg)
    this.hoverDot = s('circle', { r: 4 }, this.svg)
    this.gAxis = s('g', {}, this.svg)
    this.tip = document.createElement('div')
    this.tip.className = 'pb-live-tip'
    this.root.appendChild(this.tip)
    for (const e of [this.hoverBar, this.hoverDot]) e.style.display = 'none'

    this.svg.addEventListener('mousemove', (e) => {
      if (!this.o.interactive) return
      this.hoverX = e.clientX - this.svg.getBoundingClientRect().left
    })
    this.svg.addEventListener('mouseleave', () => (this.hoverX = null))

    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => (this.width = Math.round(this.root.getBoundingClientRect().width)))
      this.ro.observe(this.root)
    }
    this.width = Math.round(this.root.getBoundingClientRect().width)
    const loop = () => {
      this.draw()
      this.frame = requestAnimationFrame(loop)
    }
    this.frame = requestAnimationFrame(loop)
  }

  /** Replace the history (unix-second points, one per second works best). */
  setData(points: Point[]) {
    this.points = [...points].sort((a, b) => a.time - b.time)
    this.glide = null
  }

  /** Add a live value; it glides in from the previous value over `glideMs`. */
  push(value: number, time = Date.now() / 1000) {
    const last = this.points[this.points.length - 1]
    // Fill whole-second gaps flat so the line does not jump diagonally.
    if (last) for (let t = Math.floor(last.time) + 1; t < Math.floor(time); t++) this.points.push({ time: t, value: last.value })
    const from = this.currentHead() ?? value
    this.points.push({ time, value })
    this.glide = { from, to: value, start: performance.now() }
    const cutoff = time - (this.width / this.o.pxPerSecond + 10)
    while (this.points.length > 2 && this.points[1].time < cutoff) this.points.shift()
  }

  /** Show a reference value as a dashed line with a pill; `null` removes it. */
  setTarget(value: number | null) {
    this.o.target = value
  }

  /** Merge options; applied on the next frame. */
  setOptions(o: Partial<LiveChartOptions>) {
    const prev = this.o.theme
    Object.assign(this.o, o)
    if (o.theme && o.theme !== prev) {
      this.stopTheme()
      const t = watchTheme(this.o.theme, (th) => (this.theme = th, this.root.dataset.pbTheme = th))
      this.stopTheme = t.stop
      this.theme = t.theme
      this.root.dataset.pbTheme = this.theme
    }
  }

  /** Stop the loop and remove the chart. */
  destroy() {
    cancelAnimationFrame(this.frame)
    this.ro?.disconnect()
    this.stopTheme()
    this.root.remove()
  }

  private currentHead(): number | undefined {
    const g = this.glide
    if (!g) return this.points[this.points.length - 1]?.value
    const p = Math.min((performance.now() - g.start) / this.o.glideMs, 1)
    return g.from + (g.to - g.from) * easeInOutCubic(p)
  }

  private draw() {
    const W = this.width
    const H = this.o.height
    if (!W || this.points.length < 1) return
    const o = this.o
    const color = resolveColor(o.color, this.theme)
    const now = Date.now() / 1000
    const headX = W - o.headGap
    const xOf = (t: number) => headX - (now - t) * o.pxPerSecond
    const head = this.currentHead() ?? this.points[this.points.length - 1].value

    // Settled points up to the glide start, then the live head at `now`.
    const pts = this.points.slice(0, this.glide ? -1 : undefined).filter((p) => xOf(p.time) > -2 * o.pxPerSecond)
    const all = [...pts.map((p) => ({ x: xOf(p.time), v: p.value })), { x: headX, v: head }]

    // Autoscale: pad 20% of max(range, minRange); keep 20% free on top, 10% below.
    let lo = Math.min(...all.map((p) => p.v))
    let hi = Math.max(...all.map((p) => p.v))
    const e = Math.max(hi - lo, o.minRange)
    lo -= 0.2 * e
    hi += 0.2 * e
    const y = scaleLinear().domain([lo, hi]).range([0.9 * H, 0.2 * H])
    const pMin = y.invert(H)
    const pMax = y.invert(0)

    this.svg.setAttribute('width', String(W))
    this.svg.setAttribute('height', String(H + AXIS_H))

    // Line: each one-second segment is an easeInOutCubic S-curve.
    let d = ''
    all.forEach((p, i) => {
      const py = y(p.v)
      if (!i) d = `M${p.x},${py}`
      else {
        const q = all[i - 1]
        const dx = p.x - q.x
        d += `C${q.x + 0.65 * dx},${y(q.v)} ${q.x + 0.35 * dx},${py} ${p.x},${py}`
      }
    })
    this.linePath.setAttribute('d', d)
    this.linePath.setAttribute('stroke', color)

    // Area: gradient over the whole pane height, 5% → 0.
    this.areaPath.style.display = o.area ? '' : 'none'
    if (o.area) {
      if (!this.defs.firstChild) {
        const g = s('linearGradient', { id: `${this.uid}-area`, x1: 0, y1: 0, x2: 0, y2: H, gradientUnits: 'userSpaceOnUse' }, this.defs)
        s('stop', { offset: 0, 'stop-opacity': 0.051 }, g)
        s('stop', { offset: 1, 'stop-opacity': 0 }, g)
      }
      const g = this.defs.firstChild as SVGLinearGradientElement
      g.setAttribute('y2', String(H))
      g.querySelectorAll('stop').forEach((st) => st.setAttribute('stop-color', color))
      this.areaPath.setAttribute('d', `${d}L${headX},${H}L${all[0].x},${H}Z`)
      this.areaPath.setAttribute('fill', `url(#${this.uid}-area)`)
    }

    // Dashed line at the current value.
    const headY = y(head)
    this.priceLineEl.style.display = o.priceLine ? '' : 'none'
    Object.entries({ x1: 0, x2: W, y1: headY, y2: headY, stroke: color, 'stroke-opacity': 0.5 }).forEach(([k, v]) => this.priceLineEl.setAttribute(k, String(v)))

    this.drawPriceLabels(W, H, pMin, pMax, y)
    this.drawTimeAxis(W, H, now, xOf)
    this.drawTarget(W, H, y, pMin, pMax)
    this.drawHead(headX, headY, color)
    this.drawHover(W, H, now, headX, all, y, color)
  }

  /** Right-hand price labels with faint grid lines. */
  private drawPriceLabels(W: number, H: number, pMin: number, pMax: number, y: (v: number) => number) {
    const o = this.o
    const fmt = o.formatValue ?? money
    const inset = (pMax - pMin) * 0.02
    const step = priceStep(pMax - pMin - 2 * inset, o.decimals)
    const ticks: number[] = []
    for (let v = Math.ceil((pMin + inset) / step) * step; v <= pMax - inset; v += step) ticks.push(v)
    const labels = ticks.map((v) => fmt(v, o.decimals))
    const c = measureText('0'.repeat(Math.max(1, ...labels.map((l) => l.length))), FONT)
    const u = W - 10 - c
    this.gGrid.replaceChildren()
    this.gLabels.replaceChildren()
    ticks.forEach((v, i) => {
      const py = y(v)
      if (py < 0 || py > H) return
      const gl = s('line', { x1: 0, x2: u - 2, y1: py + 2.1, y2: py + 2.1, 'stroke-width': 1, 'stroke-opacity': 0.15 }, this.gGrid)
      gl.style.stroke = 'var(--pb-live-text)'
      const t = s('text', { x: u + 4 + c / 2, y: py + 2.1, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 11, 'font-family': 'Inter, InterVariable, sans-serif' }, this.gLabels)
      t.style.fill = 'var(--pb-live-text)'
      t.textContent = labels[i]
    })
    // Fade the label column into the background at the top and bottom.
    const fade = (id: string, y0: number, y1: number, from: number, to: number) => {
      let g = this.defs.querySelector<SVGLinearGradientElement>(`#${id}`)
      if (!g) {
        g = s('linearGradient', { id, x1: 0, x2: 0, gradientUnits: 'userSpaceOnUse' }, this.defs)
        s('stop', { offset: 0 }, g)
        s('stop', { offset: 1 }, g)
      }
      g.setAttribute('y1', String(y0))
      g.setAttribute('y2', String(y1))
      const [a, b] = g.querySelectorAll('stop')
      a.setAttribute('style', `stop-color:var(--pb-chart-bg,var(--pb-surface));stop-opacity:${from}`)
      b.setAttribute('style', `stop-color:var(--pb-chart-bg,var(--pb-surface));stop-opacity:${to}`)
      s('rect', { x: u, y: y0, width: c + 8, height: y1 - y0, fill: `url(#${id})` }, this.gLabels)
    }
    fade(`${this.uid}-ft`, 0, 32, 1, 0)
    fade(`${this.uid}-fb`, H - 54, H - 24, 0, 1)
  }

  /** Time strip: border line and `h:mm:ss a` labels every 10s (at 15px/s). */
  private drawTimeAxis(W: number, H: number, now: number, xOf: (t: number) => number) {
    this.gAxis.replaceChildren()
    const border = s('line', { x1: 0, x2: W, y1: H + 0.5, y2: H + 0.5, 'stroke-width': 1 }, this.gAxis)
    border.style.stroke = 'color-mix(in srgb, var(--pb-live-text) 30%, transparent)'
    const step = [1, 2, 5, 10, 15, 30, 60, 120, 300].find((n) => n * this.o.pxPerSecond >= 103.125) ?? 600
    for (let t = Math.floor(now / step) * step; xOf(t) > -40; t -= step) {
      const x = xOf(t)
      if (x > W - 30) continue
      const text = s('text', { x, y: H + 18, 'text-anchor': 'middle', 'font-size': 11, 'font-family': 'Inter, InterVariable, sans-serif' }, this.gAxis)
      text.style.fill = 'var(--pb-live-text)'
      text.textContent = formatDate(new Date(t * 1000), 'h:mm:ss a')
    }
  }

  /** Target: dashed line + pill; pinned to an edge with pulsing chevrons when off-scale. */
  private drawTarget(W: number, H: number, y: (v: number) => number, pMin: number, pMax: number) {
    this.gTarget.replaceChildren()
    const target = this.o.target
    if (target == null) return
    const state: 'above' | 'below' | null = target > pMax ? 'above' : target < pMin ? 'below' : null
    if (state !== this.pinned) {
      this.pinned = state
      this.pinnedSince = performance.now()
    }
    const ty = state === 'above' ? 10 : state === 'below' ? H - 40 : y(target)
    const p = W - 83
    const line = s('line', { x1: 0, x2: W - 82, y1: Math.round(ty) + 0.5, y2: Math.round(ty) + 0.5, 'stroke-width': 1, 'stroke-dasharray': '6 6' }, this.gTarget)
    line.style.stroke = 'var(--pb-live-target-line)'
    const top = ty - 9.5
    const bottom = ty + 9.5
    const pill = s('path', { d: `M${p + 10},${top} H${W - 8} Q${W - 3},${top} ${W - 3},${top + 5} V${bottom - 5} Q${W - 3},${bottom} ${W - 8},${bottom} H${p + 10} L${p + 1},${ty} Z`, 'stroke-linejoin': 'round', 'stroke-width': 2 }, this.gTarget)
    pill.style.fill = pill.style.stroke = 'var(--pb-live-target-pill)'
    const text = s('text', { x: state ? p + 35 : p + 44, y: ty, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 11, 'font-weight': 500, fill: '#fff', 'font-family': 'Inter, InterVariable, sans-serif' }, this.gTarget)
    text.textContent = this.o.targetLabel
    if (state) {
      const t = performance.now() - this.pinnedSince
      const op = (off: number) => {
        const f = ((t + off) % 1500) / 1500
        return f < 0.25 ? f / 0.25 : f < 0.75 ? 1 : (1 - f) / 0.25
      }
      const x = p + 60
      const chev = (y0: number, off: number) => {
        const d = state === 'above' ? `M${x},${y0 + 3} L${x + 4.5},${y0} L${x + 9},${y0 + 3}` : `M${x},${y0} L${x + 4.5},${y0 + 3} L${x + 9},${y0}`
        s('path', { d, fill: 'none', stroke: '#fff', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: op(off) }, this.gTarget)
      }
      chev(ty - 4, state === 'above' ? 0 : 400)
      chev(ty + 0.5, state === 'above' ? 400 : 0)
    }
  }

  /** Live head: 3px dot plus a ring that grows 4→10→14px every 2.6s. */
  private drawHead(x: number, y: number, color: string) {
    this.gHead.replaceChildren()
    if (this.o.pulse) {
      const ph = (performance.now() % 2600) / 2600
      let r = 14
      let fill = 0
      let stroke = 0
      if (ph < 0.25) {
        const k = ph / 0.25
        r = 4 + 6 * k
        fill = 0.25 * (1 - k)
        stroke = 0.4 + 0.4 * k
      } else if (ph < 0.525) {
        const k = (ph - 0.25) / 0.275
        r = 10 + 4 * k
        stroke = 0.8 * (1 - k)
      }
      s('circle', { cx: x, cy: y, r, fill: color, 'fill-opacity': fill }, this.gHead)
      s('circle', { cx: x, cy: y, r: r + 0.5, fill: 'none', stroke: color, 'stroke-opacity': stroke, 'stroke-width': 1 }, this.gHead)
    }
    s('circle', { cx: x, cy: y, r: 3, fill: color }, this.gHead)
  }

  private drawHover(W: number, H: number, now: number, headX: number, all: { x: number; v: number }[], y: (v: number) => number, color: string) {
    const hx = this.hoverX
    const on = hx !== null && hx <= headX && hx >= all[0].x
    this.hoverBar.style.display = this.hoverDot.style.display = on ? '' : 'none'
    this.tip.style.opacity = on ? '1' : '0'
    if (!on || hx === null) return
    // Value on the eased segment under the cursor.
    let v = all[all.length - 1].v
    for (let i = 1; i < all.length; i++) {
      if (all[i].x >= hx) {
        const a = all[i - 1]
        const b = all[i]
        const k = b.x === a.x ? 1 : (hx - a.x) / (b.x - a.x)
        v = a.v + (b.v - a.v) * ease.easeInOutCubicApprox(k)
        break
      }
    }
    const py = y(v)
    Object.entries({ x1: hx, x2: hx, y1: 35, y2: H }).forEach(([k, val]) => this.hoverBar.setAttribute(k, String(val)))
    this.hoverDot.setAttribute('cx', String(hx))
    this.hoverDot.setAttribute('cy', String(py))
    this.hoverDot.setAttribute('fill', color)
    const t = now - (headX - hx) / this.o.pxPerSecond
    const date = new Date(t * 1000)
    const fmt = this.o.formatTooltipValue ?? ((n: number) => money(n, 2))
    this.tip.innerHTML = `<div class="pb-live-tip-v" style="color:${color}"></div><div class="pb-live-tip-d"><span>${formatDate(date, 'MMM d, yyyy')}</span><span>${formatDate(date, 'h:mm:ss a')}</span></div>`
    ;(this.tip.firstElementChild as HTMLElement).textContent = fmt(v)
    const w = this.tip.getBoundingClientRect().width
    const x = Math.max(w / 2 + 1, Math.min(hx, W - w / 2 - 80))
    this.tip.style.transform = `translate(calc(${x}px - 50%), -5px)`
  }
}
