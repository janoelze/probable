// Gauge: a 200° arc showing one probability, for compact cards ("56% Up").

import { injectStyles, watchTheme, type ThemeName, type ThemeOption } from './theme'

export interface GaugeOptions {
  /** 0..1 */
  value?: number
  /** Arc color (default green, drawn at `opacity`). */
  color?: string
  /** Opacity of the value arc (default 0.55 light, 0.9 dark). */
  opacity?: number
  /** Arc radius in px. */
  radius?: number
  strokeWidth?: number
  /** Total sweep in degrees (200 = 10° below horizontal on each side). */
  sweep?: number
  /** Gap between value arc and track, in degrees on each side. */
  gap?: number
  /** Text centred under the arc, e.g. "56%". */
  label?: string
  /** Light, dark or auto. */
  theme?: ThemeOption
  /** Animate value changes. */
  animate?: boolean
}

export const GAUGE_DEFAULTS: Required<Omit<GaugeOptions, 'label' | 'opacity'>> & { label: string; opacity?: number } = {
  value: 0.5,
  color: 'lab(45.7361% -45.2267 37.3056)',
  theme: 'light',
  radius: 29,
  strokeWidth: 4.5,
  sweep: 200,
  gap: 6,
  label: '',
  animate: true,
}

const SVG = 'http://www.w3.org/2000/svg'
const r2 = (n: number) => Math.round(n * 100) / 100

/** SVG arc between two angles (degrees, math orientation: 0° = right, counter-clockwise up). */
function arc(r: number, from: number, to: number): string {
  const p = (a: number) => {
    const rad = (a * Math.PI) / 180
    return `${r2(r * Math.cos(rad))} ${r2(-r * Math.sin(rad))}`
  }
  const large = Math.abs(from - to) > 180 ? 1 : 0
  return `M ${p(from)} A ${r} ${r} 0 ${large} 1 ${p(to)}`
}

export class Gauge {
  readonly el: HTMLElement
  private o: typeof GAUGE_DEFAULTS
  private svg: SVGSVGElement
  private track: SVGPathElement
  private bar: SVGPathElement
  private text: HTMLSpanElement
  private shown = -1
  private root: HTMLDivElement
  private theme: ThemeName
  private stopTheme: () => void

  /** Renders an inline gauge into `el`. */
  constructor(el: HTMLElement, options: GaugeOptions = {}) {
    injectStyles(el.ownerDocument)
    this.el = el
    this.o = { ...GAUGE_DEFAULTS, ...options }
    const root = (this.root = document.createElement('div'))
    root.className = 'pb-root pb-gauge'
    el.appendChild(root)
    const t = watchTheme(this.o.theme, (th) => ((this.theme = th), this.render()))
    this.theme = t.theme
    this.stopTheme = t.stop
    this.svg = document.createElementNS(SVG, 'svg')
    this.svg.style.overflow = 'visible'
    this.track = document.createElementNS(SVG, 'path')
    this.bar = document.createElementNS(SVG, 'path')
    for (const p of [this.track, this.bar]) {
      p.setAttribute('fill', 'none')
      p.setAttribute('stroke-linecap', 'round')
      this.svg.appendChild(p)
    }
    this.track.style.stroke = 'var(--pb-gauge-track)'
    root.appendChild(this.svg)
    this.text = document.createElement('span')
    this.text.className = 'pb-gauge-label'
    root.appendChild(this.text)
    this.render()
  }

  /** Animate to a new value (400ms easeOutCubic). */
  setValue(value: number, label?: string) {
    this.setOptions({ value, ...(label !== undefined && { label }) })
  }

  /** Merge options and re-render. */
  setOptions(o: Partial<GaugeOptions>) {
    const prev = this.o.theme
    Object.assign(this.o, o)
    if (o.theme && o.theme !== prev) {
      this.stopTheme()
      const t = watchTheme(this.o.theme, (th) => ((this.theme = th), this.render()))
      this.stopTheme = t.stop
      this.theme = t.theme
    }
    this.render()
  }

  /** Remove the gauge. */
  destroy() {
    this.stopTheme()
    this.root.remove()
  }

  private render() {
    const { radius: r, strokeWidth, sweep, color, label } = this.o
    this.root.dataset.pbTheme = this.theme
    const opacity = this.o.opacity ?? (this.theme === 'dark' ? 0.9 : 0.55)
    const below = (sweep - 180) / 2
    const h = r + r * Math.sin((below * Math.PI) / 180)
    this.svg.setAttribute('width', String(2 * r))
    this.svg.setAttribute('height', String(r2(h)))
    this.svg.setAttribute('viewBox', `${-r} ${-r} ${2 * r} ${r2(h)}`)
    for (const p of [this.track, this.bar]) p.setAttribute('stroke-width', String(strokeWidth))
    this.bar.setAttribute('stroke', color)
    this.bar.setAttribute('stroke-opacity', String(opacity))
    this.text.textContent = label
    this.text.style.display = label ? '' : 'none'

    const target = Math.max(0, Math.min(1, this.o.value))
    const from = this.shown < 0 ? (this.o.animate ? 0 : target) : this.shown
    if (!this.o.animate || from === target) return this.draw(target)
    const t0 = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 400)
      this.draw(from + (target - from) * (1 - (1 - t) ** 3))
      if (t < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }

  private draw(v: number) {
    const { radius: r, sweep, gap } = this.o
    const start = 90 + sweep / 2
    const end = 90 - sweep / 2
    const at = start - sweep * v
    this.shown = v
    // Value arc from the left end, track from the right end, `gap`° either side of the split.
    const barEnd = v >= 1 ? end : at + gap
    const trackStart = v <= 0 ? start : at - gap
    this.bar.setAttribute('d', barEnd < start ? arc(r, start, Math.max(barEnd, end)) : '')
    this.track.setAttribute('d', trackStart > end ? arc(r, Math.min(trackStart, start), end) : '')
  }
}
