// Sparkline: a compact probability line for cards and table rows, with a
// draw-in animation, a faint track and a pulsing end dot.

import { scaleLinear } from 'd3-scale'
import { line, curveMonotoneX, type CurveFactory } from 'd3-shape'
import { injectStyles, resolveColor, watchTheme, type ThemeName, type ThemeOption } from './theme'
import { ease, tween, type Cancel } from './motion'

export interface SparklineOptions {
  /** Values 0..1, oldest first. */
  data?: number[]
  /** Line + dot color; `currentColor` follows the text color. */
  color?: string
  /** Fixed height; defaults to the container's height. */
  height?: number
  /** `'fixed'`: y from min(data, `floor`) to 1. `'centered'`: zoomed so the last value sits mid-height. */
  scale?: 'fixed' | 'centered'
  /** Lower bound for `'fixed'` (default 0.5, so favourites fill the card; use 0 for the full range). */
  floor?: number
  /** Dashed 50% line. */
  midline?: boolean
  /** 15%-opacity copy of the full line behind the trace. */
  track?: boolean
  /** Sonar ring on the end dot (scale 1→3.5, 1.8s). */
  pulse?: boolean
  /** 600ms draw-in (easeOutCubic) on first render. */
  animateIn?: boolean
  /** Line width (1.5; 1.7 for the widget appearance). */
  strokeWidth?: number
  /** End dot radius (4; 3 for the widget appearance). */
  dotRadius?: number
  /** Space kept right of the last point (table rows and cards: 8). */
  rightInset?: number
  /** `'widget'`: thicker line, haloed smaller dot, no pulse; for hover cards with scrubbing. */
  appearance?: 'default' | 'widget'
  /** d3-shape curve. */
  curve?: CurveFactory
  /** Light, dark or auto. */
  theme?: ThemeOption
  /** Enables scrubbing; called with the hovered value/index (null, -1 on leave). */
  onHover?: (value: number | null, index: number) => void
  /** Per-point labels shown under the line while scrubbing. */
  hoverLabels?: string[]
}

const SVG = 'http://www.w3.org/2000/svg'
const s = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, parent?: Element) => {
  const el = document.createElementNS(SVG, tag)
  for (const k in attrs) el.setAttribute(k, String(attrs[k]))
  parent?.appendChild(el)
  return el
}

/** Suggested line colors. */
export const SPARK_COLORS = {
  blue: 'lab(44.7153% 32.3672 -86.8665)',
  red: 'lab(47.8918% 72.1772 58.3835)',
  green: 'lab(56.1642% -52.1702 40.2684)',
}

/** Defaults. The `widget` appearance switches to stroke 1.7, dot 3 and no pulse. */
export const SPARKLINE_DEFAULTS = {
  data: [] as number[],
  color: SPARK_COLORS.blue,
  scale: 'fixed' as const,
  floor: 0.5,
  midline: false,
  track: true,
  pulse: true,
  animateIn: true,
  strokeWidth: 1.5,
  dotRadius: 4,
  rightInset: 8,
  appearance: 'default' as const,
  curve: curveMonotoneX,
  theme: 'light' as ThemeOption,
}

export class Sparkline {
  readonly el: HTMLElement
  private o: Required<Omit<SparklineOptions, 'onHover' | 'hoverLabels' | 'height'>> & Pick<SparklineOptions, 'onHover' | 'hoverLabels' | 'height'>
  private root: HTMLDivElement
  private svg: SVGSVGElement
  private ro: ResizeObserver | null = null
  private theme: ThemeName
  private stopTheme: () => void
  private progress = -1
  private hoverIndex = -1
  private cancel: Cancel | null = null
  private sonar: Animation | null = null
  private trace: SVGPathElement | null = null
  private rule: SVGLineElement | null = null
  private label: SVGTextElement | null = null
  private dots: SVGGElement | null = null
  private size = { w: 0, h: 0 }
  private key = ''

  /** Renders into `el`, filling its width and height (or `height`). */
  constructor(el: HTMLElement, options: SparklineOptions = {}) {
    injectStyles(el.ownerDocument)
    this.el = el
    const fw = options.appearance === 'widget'
    this.o = {
      ...SPARKLINE_DEFAULTS,
      pulse: !fw,
      strokeWidth: fw ? 1.7 : 1.5,
      dotRadius: fw ? 3 : 4,
      ...options,
    }
    const t = watchTheme(this.o.theme, (th) => { this.theme = th; this.render() })
    this.theme = t.theme
    this.stopTheme = t.stop
    this.root = document.createElement('div')
    this.root.className = 'pb-root pb-sparkline'
    this.root.style.height = this.o.height ? `${this.o.height}px` : '100%'
    el.appendChild(this.root)
    this.svg = s('svg', {}, this.root)
    this.svg.style.overflow = 'visible'
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.measure())
      this.ro.observe(this.root)
    }
    this.measure()
  }

  /** Replace the values (spaced by index). */
  setData(data: number[]) {
    this.o.data = data
    this.render()
  }

  /** Merge options and re-render. */
  setOptions(o: Partial<SparklineOptions>) {
    Object.assign(this.o, o)
    if (o.height !== undefined) this.root.style.height = `${o.height}px`
    this.render()
  }

  /** Re-run the draw-in (e.g. when a table row is hovered). */
  retrace() {
    this.sonar?.cancel()
    this.setProgress(0)
    this.animateTo(1, 600)
  }

  /** Stop animations and remove the sparkline. */
  destroy() {
    this.ro?.disconnect()
    this.stopTheme()
    this.cancel?.()
    this.sonar?.cancel()
    this.root.remove()
  }

  private measure() {
    const r = this.root.getBoundingClientRect()
    const w = r.width
    const h = this.o.height ?? r.height
    if (w !== this.size.w || h !== this.size.h) {
      this.size = { w, h }
      this.render()
    }
  }

  /** `J()`: room kept at the ends so the pulsing ring is not cut off. */
  private endpointInset() {
    const fw = this.o.appearance === 'widget'
    const r = this.o.dotRadius
    return Math.max(fw ? 3 + 5.44 + 1.516 : r, this.o.pulse ? 3.5 * r : r)
  }

  private render() {
    const { w, h } = this.size
    const o = this.o
    const data = o.data
    this.root.dataset.pbTheme = this.theme
    this.svg.replaceChildren()
    this.svg.setAttribute('width', String(w))
    this.svg.setAttribute('height', String(h))
    if (w <= 0) return
    const color = resolveColor(o.color, this.theme)

    if (data.length < 2) {
      // Empty state: one dashed gray-300 line across the middle.
      const ln = s('line', { x1: 0, y1: h / 2, x2: w, y2: h / 2, 'stroke-width': o.strokeWidth, 'stroke-dasharray': '6 4', 'vector-effect': 'non-scaling-stroke' }, s('g', {}, this.svg))
      ln.style.stroke = 'var(--pb-gray-300)'
      return
    }

    const P = this.endpointInset()
    const bottomInset = o.hoverLabels ? 20 : 0
    const ox = Math.min(P + 2, w / 2)
    const x = scaleLinear().domain([0, data.length - 1]).range([ox, Math.max(w - Math.max(o.rightInset, ox), ox)])
    const hh = Math.max(h - bottomInset, 0)
    const oy = Math.min(P + 2, hh / 2)
    let domain: [number, number]
    if (o.scale === 'centered') {
      const last = data[data.length - 1]
      const t = Math.max(1.3 * data.reduce((m, v) => Math.max(m, Math.abs(v - last)), 0), 0.02)
      domain = [last - t, last + t]
    } else {
      const floor = o.floor
      domain = [data.reduce((m, v) => Math.min(m, v), floor), 1]
    }
    const y = scaleLinear().domain(domain).range([hh - oy, oy])

    const d = line<number>().x((_, i) => x(i)).y((v) => y(v)).curve(o.curve)(data) ?? ''
    const g = s('g', {}, this.svg)
    if (o.midline) {
      const ml = s('line', { x1: 0, y1: y(0.5), x2: w, y2: y(0.5), 'stroke-width': o.strokeWidth, 'stroke-dasharray': '6 4', 'vector-effect': 'non-scaling-stroke' }, g)
      ml.style.stroke = 'var(--pb-gray-200)'
    }
    const attrs = { d, fill: 'transparent', stroke: color, 'stroke-width': o.strokeWidth, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke', class: 'pb-line' }
    if (o.track) s('path', { ...attrs, 'stroke-opacity': 0.15 }, g)
    this.trace = s('path', attrs, g)

    this.rule = s('line', { x1: 0, y1: oy, x2: 0, y2: Math.max(h - bottomInset, 0), stroke: 'var(--pb-border)', 'stroke-width': 1 }, this.svg)
    this.rule.style.display = 'none'

    this.dots = s('g', {}, this.svg)
    if (o.appearance === 'widget') s('circle', { cx: 0, cy: 0, r: o.dotRadius + 5.44, fill: color, opacity: 0.08 }, this.dots)
    const sonar = s('circle', { class: 'sonar', cx: 0, cy: 0, r: o.dotRadius, fill: color }, this.dots)
    sonar.style.cssText = 'opacity:0;transform-box:fill-box;transform-origin:center'
    s('circle', { cx: 0, cy: 0, r: o.dotRadius, fill: color }, this.dots)

    this.label = null
    if (o.hoverLabels) {
      this.label = s('text', { x: 0, y: h - 4, 'text-anchor': 'middle' }, this.svg)
      this.label.style.cssText = 'display:none;font-size:11px;fill:var(--pb-content-tertiary)'
    }
    if (o.onHover) {
      const hit = s('rect', { x: 0, y: 0, width: w, height: h, fill: 'transparent', 'aria-hidden': 'true' }, this.svg)
      hit.style.cursor = 'crosshair'
      hit.addEventListener('mousemove', (ev) => this.scrub(ev, x, y))
      hit.addEventListener('mouseleave', () => this.endScrub())
    }

    // First render draws in (600ms easeOutCubic) and then starts the sonar;
    // re-renders keep the current progress.
    const key = `${w}:${h}:${data.join(',')}`
    const first = this.progress < 0
    if (first && o.animateIn) {
      this.setProgress(0)
      this.animateTo(1, 600)
    } else {
      this.setProgress(first ? 1 : this.progress)
      if (first || key !== this.key) this.startSonar()
    }
    this.key = key
  }

  private setProgress(p: number) {
    const t = this.trace
    if (!t) return
    const L = t.getTotalLength()
    const r = Math.max(0, Math.min(p, 1))
    t.setAttribute('stroke-dasharray', `${L}`)
    t.setAttribute('stroke-dashoffset', String(L - r * L))
    const pt = t.getPointAtLength(r * L)
    this.moveDots(pt.x, pt.y)
    this.rule?.setAttribute('x1', String(pt.x))
    this.rule?.setAttribute('x2', String(pt.x))
    this.progress = r
  }

  private moveDots(x: number, y: number) {
    this.dots?.querySelectorAll('circle').forEach((c) => {
      c.setAttribute('cx', String(x))
      c.setAttribute('cy', String(y))
    })
  }

  private animateTo(target: number, duration: number) {
    this.cancel?.()
    this.sonar?.cancel()
    const from = this.progress < 0 ? 0 : this.progress
    this.cancel = tween({
      duration,
      ease: ease.easeOutCubic,
      onUpdate: (t) => this.setProgress(from + (target - from) * t),
      onComplete: () => this.startSonar(),
    })
  }

  private startSonar() {
    this.sonar?.cancel()
    this.sonar = null
    if (!this.o.pulse) return
    const c = this.dots?.querySelector('.sonar') as SVGCircleElement | null
    this.sonar = c?.animate([{ transform: 'scale(1)', opacity: 0.4 }, { transform: 'scale(3.5)', opacity: 0 }], { duration: 1800, easing: 'ease-out', iterations: Infinity }) ?? null
  }

  private scrub(ev: MouseEvent, x: (i: number) => number & { invert?: unknown }, y: (v: number) => number) {
    const t = this.trace
    if (!t) return
    this.cancel?.()
    const data = this.o.data
    const rect = (ev.currentTarget as Element).getBoundingClientRect()
    const xs = x as unknown as { (i: number): number; invert(px: number): number }
    const i = Math.max(0, Math.min(data.length - 1, Math.round(xs.invert(ev.clientX - rect.left))))
    this.hoverIndex = i
    // Binary-search the arc length whose x matches the hovered point.
    const L = t.getTotalLength()
    const cx = xs(i)
    let lo = 0
    let hi = L
    for (let k = 0; k < 20; k++) {
      const mid = (lo + hi) / 2
      if (t.getPointAtLength(mid).x < cx) lo = mid
      else hi = mid
    }
    this.sonar?.cancel()
    this.setProgress((lo + hi) / 2 / L)
    const cy = y(data[i])
    if (this.rule) {
      this.rule.style.display = ''
      this.rule.setAttribute('x1', String(cx))
      this.rule.setAttribute('x2', String(cx))
    }
    this.moveDots(cx, cy)
    if (this.label) {
      const text = this.o.hoverLabels?.[i]
      if (text) {
        this.label.textContent = text
        this.label.style.display = ''
        const half = this.label.getComputedTextLength() / 2
        this.label.setAttribute('x', String(Math.max(half + 2, Math.min(this.size.w - half - 2, cx))))
      } else this.label.style.display = 'none'
    }
    this.o.onHover?.(data[i], i)
  }

  private endScrub() {
    this.hoverIndex = -1
    if (this.rule) this.rule.style.display = 'none'
    if (this.label) this.label.style.display = 'none'
    this.o.onHover?.(null, -1)
    const p = this.progress
    if (p < 0) return
    if (p >= 0.999) return this.startSonar()
    this.animateTo(1, Math.max(150, (1 - p) * 400))
  }
}
