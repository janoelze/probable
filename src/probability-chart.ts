// ProbabilityChart: multi-line probability chart over time, framework-agnostic.

import { scaleLinear, scaleTime, type ScaleLinear, type ScaleTime } from 'd3-scale'
import { area as d3area, line, curveMonotoneX, type CurveFactory } from 'd3-shape'
import { bisector, extent, min, max } from 'd3-array'
import { interpolateRound } from 'd3-interpolate'
// @ts-expect-error: package ships no types
import { interpolatePath } from 'd3-interpolate-path'

import { injectStyles, mixHsl, resolveColor, watchTheme, type ThemeName, type ThemeOption } from './theme'
import { niceTicks, timeTicks } from './ticks'
import { formatDate, formatLegendValue, formatValue, measureText, summaryParts, truncate } from './format'
import { ease, setPathLength, clearPathLength, spring, tween, type Cancel } from './motion'
import type { Point, Series } from './data'

/** How current values are shown: labels at the line ends, or a legend + hover pills. */
export type LabelMode = 'end' | 'legend'

/** `percent` for probabilities (0..1), `number`/`currency` for anything else. */
export type ValueFormat = 'percent' | 'number' | 'currency'

export interface TimeWindow { key: string; label: string }

export interface HoverPoint {
  id: string
  label: string
  color: string
  decimals: number
  point: Point
}

export interface ProbabilityChartOptions {
  /** Series to render (or call `setSeries()`). */
  series?: Series[]
  /** Plot height in px. */
  height?: number
  /** Light or dark tokens; `'auto'` follows `prefers-color-scheme`. */
  theme?: ThemeOption
  /** `'end'`: name + value at the end of each line. `'legend'`: legend row + pills on hover. `'auto'`: end labels for exactly 2 series. */
  labels?: LabelMode | 'auto'
  /** Wrap end labels to two lines at this width (px), sharing one column width. Good for long names. */
  labelMaxWidth?: number
  /** Bottom time axis. */
  xAxis?: boolean
  /** Percent axis. */
  yAxis?: boolean
  /** Side of the percent axis. */
  yAxisOrientation?: 'right' | 'left'
  /** Dotted rows at each y tick (gray-400, 50%, dash `1,3`). */
  gridHorizontal?: boolean
  /** Dotted columns. */
  gridVertical?: boolean
  /** Fit the y axis to the data (ticks prefer five steps); `false` pins it to 0–100%. */
  autoscale?: boolean
  /** Short time labels with an interval at least 48px wide (homepage cards). */
  compactTimeAxis?: boolean
  /** Legend row above the plot in legend mode. `'auto'` hides it for a single series. */
  legend?: boolean | 'auto'
  /** Header with the current value and its change over the range; replaces the legend. `'auto'` = on for `number`/`currency`. */
  summary?: boolean | 'auto'
  /** Content for the right end of the legend row, e.g. a logo. */
  watermark?: string | Node | false
  /** Small source chip in the bottom-left corner, e.g. `'Source: Acme'`. */
  attribution?: string | false
  /** Render the time-window selector under the plot. */
  timeWindows?: boolean
  /** Selected window key (highlighted in the selector). */
  window?: string
  /** Selector entries (default 1H 6H 1D 1W 1M ALL). */
  windows?: TimeWindow[]
  /** Called when the user picks a time window. */
  onWindowChange?: (key: string) => void
  /** All motion: draw-in, morphs, fades, pulses. */
  animate?: boolean
  /** One-time light sweep along each line after it draws in. */
  shimmer?: boolean
  /** Repeating ring around the end dot (scale 1→4 over 2.25s). */
  pulse?: boolean
  /** Hover crosshair, markers, date and value tooltips. */
  interactive?: boolean
  /** Drag across the plot to compare two points; release to pin, click to clear. */
  dragRange?: boolean
  /** Clicking copies the hovered unix timestamp. */
  clickToCopy?: boolean
  /** Line width in px. */
  strokeWidth?: number
  /** d3-shape curve. */
  curve?: CurveFactory
  /**
   * Gradient line: the stroke runs from `startColor` at
   * the bottom (50% opacity) to the color of the current value; dots and labels
   * take the color of their value. Both must be 6-digit hex.
   */
  startColor?: string
  endColor?: string
  /** Value that sets the gradient's end color; defaults to the first series' last point. */
  lastPrice?: number
  /** Fill under each line, fading from `area` opacity (e.g. 0.05) to 0. `true` = 0.05. */
  area?: boolean | number
  /** `percent` (0..1 → "42%"), `number` ("6,594") or `currency` ("$1.2M"). */
  valueFormat?: ValueFormat
  /** Unit shown after the summary value, e.g. `'cases'`. */
  unit?: string
  /** Value formatter for labels, pills and the y axis. */
  formatValue?: (v: number, decimals: number) => string
  /** Formatter for the hover date (default `MMM d, h:mm a`). */
  formatDate?: (d: Date) => string
  /** Hover callback; `null` when the pointer leaves. */
  onHover?: (points: HoverPoint[] | null, date: Date | null) => void
  /** Margins override (computed from the axis labels by default). */
  margin?: Partial<Margin>
}

interface Margin { top: number; right: number; bottom: number; left: number }

interface Resolved extends Required<Omit<ProbabilityChartOptions, 'series' | 'onWindowChange' | 'onHover' | 'margin' | 'formatDate' | 'watermark' | 'formatValue' | 'startColor' | 'endColor' | 'lastPrice'>> {
  startColor?: string
  endColor?: string
  lastPrice?: number
  watermark: string | Node | false
  formatValue: (v: number, decimals: number) => string
  formatDate: (d: Date) => string
  margin?: Partial<Margin>
  onWindowChange?: (key: string) => void
  onHover?: ProbabilityChartOptions['onHover']
}

/** Default options. */
export const CHART_DEFAULTS: Omit<Resolved, 'formatValue' | 'formatDate'> = {
  height: 240,
  theme: 'light',
  labels: 'auto',
  labelMaxWidth: 0,
  xAxis: true,
  yAxis: true,
  yAxisOrientation: 'right',
  gridHorizontal: true,
  gridVertical: false,
  autoscale: true,
  compactTimeAxis: false,
  legend: 'auto',
  summary: 'auto',
  watermark: false,
  attribution: false,
  timeWindows: false,
  window: 'all',
  windows: [],
  valueFormat: 'percent',
  unit: '',
  animate: true,
  shimmer: true,
  pulse: true,
  interactive: true,
  dragRange: true,
  clickToCopy: false,
  strokeWidth: 1.75,
  curve: curveMonotoneX,
  area: false,
}

// Side-label layout constants (SIDE_ODDS_CONSTANTS).
const LABEL_HEIGHT = 30
const LABEL_GAP = 25
const BOTTOM_MARGIN = 12
const TOP_MARGIN = 0
const MIN_DISTANCE = LABEL_HEIGHT + LABEL_GAP
const SIDE_ODDS_X_OFFSET = 15
// Wrapped end labels (labelMaxWidth).
const ONE_LINE_HEIGHT = 40
const TWO_LINE_HEIGHT = 54
const WRAPPED_GAP = 2
const DATE_LABEL_GAP = 6
const LABEL_FONT = { fontWeight: 500, fontSize: 13, fontFamily: 'Inter, sans-serif' }

const WINDOWS: TimeWindow[] = [
  { key: '1h', label: '1H' }, { key: '6h', label: '6H' }, { key: '1d', label: '1D' },
  { key: '1w', label: '1W' }, { key: '1m', label: '1M' }, { key: 'all', label: 'ALL' },
]

const SVG = 'http://www.w3.org/2000/svg'
function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, parent?: Element): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG, tag)
  for (const k in attrs) el.setAttribute(k, String(attrs[k]))
  parent?.appendChild(el)
  return el
}
function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', parent?: Element): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  if (cls) el.className = cls
  parent?.appendChild(el)
  return el
}

const dateOf = (p: Point) => new Date(p.time * 1000)

/** Width of a label broken at its best space/hyphen into two lines (≤ maxW). */
function wrappedWidth(label: string, maxW: number): number {
  const w = measureText(label, LABEL_FONT)
  if (w <= maxW) return w
  let best = maxW
  for (let i = 1; i < label.length; i++) {
    const prev = label[i - 1]
    if (prev !== '-' && prev.trim() !== '') continue
    const a = label.slice(0, i).trimEnd()
    const b = label.slice(i).trimStart()
    if (a && b) best = Math.min(best, Math.max(measureText(a, LABEL_FONT), measureText(b, LABEL_FONT)))
  }
  return best
}
const bisectDate = bisector((p: Point) => dateOf(p)).left
const isMobile = () => typeof window !== 'undefined' && window.innerWidth < 768

interface ResolvedSeries extends Required<Omit<Series, 'backfilledData'>> {
  backfilledData: Point[]
  stroke: string
}

interface Layout {
  width: number
  height: number
  margin: Margin
  plotH: number
  x: ScaleTime<number, number>
  y: ScaleLinear<number, number>
  yTicks: number[]
  xTicks: Date[]
  xFormat: (d: Date) => string
  sideOffset: number
  chartEndX: number
  odds: LabelMode
  /** Shared end-label column width when wrapping (labelMaxWidth). */
  labelWidth: number
  paths: Map<string, { d: string; backfillEndX?: number }>
}

interface SeriesEls {
  g: SVGGElement
  area?: SVGPathElement
  underlay: SVGPathElement
  main: SVGPathElement
  shimmer: SVGPathElement
  mask?: SVGPathElement
  dashed?: SVGPathElement
  dot: SVGGElement
  dotCircle: SVGCircleElement
  pulse: SVGCircleElement
  pulseAnim?: Animation
  d: string
  ready: boolean
  cancel: Cancel[]
}

interface Hover {
  x: number
  data: HoverPoint[]
  tops: number[]
}

export class ProbabilityChart {
  readonly el: HTMLElement
  private o: Resolved
  private series: ResolvedSeries[] = []
  private theme: ThemeName
  private stopTheme: () => void
  private root: HTMLDivElement
  private legendRow: HTMLDivElement
  private summaryEl: HTMLDivElement
  private plot: HTMLDivElement
  private inner: HTMLDivElement
  private svg: SVGSVGElement
  private gPlot: SVGGElement
  private gXAxis: SVGGElement
  private gYAxis: SVGGElement
  private hit: SVGRectElement
  private gGrid: SVGGElement
  private gLines: SVGGElement
  private gDots: SVGGElement
  private crosshair: SVGLineElement
  private anchorLine: SVGLineElement
  private gMarkers: SVGGElement
  private attribution: HTMLDivElement
  private dateTip: HTMLDivElement
  private pills: HTMLDivElement
  private side: HTMLDivElement
  private windows: HTMLDivElement
  private errorEl: HTMLDivElement
  private els = new Map<string, SeriesEls>()
  private uid = `pb${Math.random().toString(36).slice(2, 8)}`
  private defs!: SVGDefsElement
  private layout: Layout | null = null
  private width = 0
  private ro: ResizeObserver | null = null
  private hover: Hover | null = null
  private largestLabelWidth = 120
  private clip = -13
  private clipCancel: Cancel | null = null
  private dateLeft = 0
  private dateLeftCancel: Cancel | null = null
  private drag: { pending: boolean; active: boolean; locked: boolean; downX: number; anchorX: number; anchorData: HoverPoint[] | null; suppressClick: boolean } = {
    pending: false, active: false, locked: false, downX: 0, anchorX: 0, anchorData: null, suppressClick: false,
  }
  private lastMove = 0
  private moveFrame = 0
  private mounted = false
  private firstRender = true
  private loadToken = 0

  /** Renders into `el` (fills its width). Injects the shared stylesheet once. */
  constructor(el: HTMLElement, options: ProbabilityChartOptions = {}) {
    injectStyles(el.ownerDocument)
    this.el = el
    this.o = this.resolve(options)
    const t = watchTheme(this.o.theme, (th) => this.setTheme(th))
    this.theme = t.theme
    this.stopTheme = t.stop

    this.root = h('div', 'pb-root', el)
    this.legendRow = h('div', 'pb-legend-row', this.root)
    this.summaryEl = h('div', 'pb-summary', this.root)
    this.plot = h('div', 'pb-plot', this.root)
    this.plot.style.marginTop = '28px'
    this.inner = h('div', '', this.plot)
    this.inner.style.cssText = 'display:flex;width:100%;height:100%;position:relative;overflow:visible'
    this.svg = s('svg', {}, this.inner)
    this.defs = s('defs', {}, this.svg)
    this.gPlot = s('g', { overflow: 'visible' }, this.svg)
    const axes = s('g', {}, this.gPlot)
    this.gXAxis = s('g', { class: 'pb-axis pb-axis-bottom' }, axes)
    this.gYAxis = s('g', { class: 'pb-axis pb-axis-right' }, axes)
    this.hit = s('rect', { x: 0, y: 0, rx: 0, fill: 'transparent' }, this.gPlot)
    this.gGrid = s('g', {}, this.gPlot)
    this.gLines = s('g', { id: 'line-chart' }, this.gPlot)
    this.gDots = s('g', {}, this.gLines)
    this.crosshair = s('line', { stroke: 'var(--pb-gray-100)', 'stroke-width': 1.5, 'pointer-events': 'none' }, this.gPlot)
    this.anchorLine = s('line', { stroke: 'var(--pb-gray-100)', 'stroke-width': 1.5, 'pointer-events': 'none' }, this.gPlot)
    this.gMarkers = s('g', {}, this.gPlot)
    for (const l of [this.crosshair, this.anchorLine]) l.style.display = 'none'
    this.attribution = h('div', 'pb-attribution', this.inner)
    h('span', '', this.attribution)
    this.dateTip = h('div', 'pb-date-tip pb-off', this.inner)
    this.pills = h('div', 'pb-pills', this.inner)
    this.side = h('div', 'pb-side', this.inner)
    this.errorEl = h('div', 'pb-error', this.inner)
    this.errorEl.style.display = 'none'
    this.windows = h('div', 'pb-windows', this.root)

    this.bindEvents()
    this.series = this.resolveSeries(options.series ?? [])
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.measure())
      this.ro.observe(this.plot)
    }
    this.measure()
  }

  // ── public API ──────────────────────────────────────────────────────────

  /** Replace the data. Changed paths morph; series are matched by `id`. */
  setSeries(series: Series[]) {
    this.series = this.resolveSeries(series)
    this.render()
  }

  /** Merge options and re-render. */
  setOptions(options: Partial<ProbabilityChartOptions>) {
    const prevTheme = this.o.theme
    this.o = this.resolve({ ...this.o, ...options })
    if (options.theme && options.theme !== prevTheme) {
      this.stopTheme()
      const t = watchTheme(this.o.theme, (th) => this.setTheme(th))
      this.stopTheme = t.stop
      this.theme = t.theme
    }
    if (options.series) this.series = this.resolveSeries(options.series)
    else this.series = this.resolveSeries(this.series)
    this.render()
  }

  /** Select a window in the selector and fire `onWindowChange`. Load the matching data yourself. */
  setWindow(w: string) {
    this.o.window = w
    this.renderWindows()
    this.o.onWindowChange?.(w)
  }

  /** Stop timers and observers and remove the chart. */
  destroy() {
    this.ro?.disconnect()
    this.stopTheme()
    this.clipCancel?.()
    this.dateLeftCancel?.()
    for (const e of this.els.values()) e.cancel.forEach((c) => c())
    this.root.remove()
  }

  // ── options / series ───────────────────────────────────────────────────

  private customFormat = false

  private resolve(o: ProbabilityChartOptions): Resolved {
    this.customFormat = !!o.formatValue && o.formatValue !== this.o?.formatValue
    const r = { ...CHART_DEFAULTS, ...o } as Resolved
    r.formatValue = o.formatValue ?? ((v, d) => formatValue(v, d, r.valueFormat))
    r.formatDate = o.formatDate ?? ((d) => formatDate(d, 'MMM d, h:mm a'))
    return r
  }

  private resolveSeries(list: Series[]): ResolvedSeries[] {
    return list
      .filter((x) => x.data.length)
      .map((x) => ({
        id: x.id,
        label: x.label,
        color: x.color,
        stroke: resolveColor(x.color, this.theme),
        data: [...x.data].sort((a, b) => a.time - b.time),
        backfilledData: x.backfilledData ?? [],
        decimals: x.decimals ?? 0,
      }))
  }

  private setTheme(t: ThemeName) {
    this.theme = t
    this.series = this.resolveSeries(this.series)
    this.render()
  }

  // ── layout ─────────────────────────────────────────────────────────

  private measure() {
    const w = Math.round(this.plot.getBoundingClientRect().width)
    if (w && w !== this.width) {
      this.width = w
      this.render()
    } else if (!this.mounted) this.render()
  }

  /** Y tick decimals: percent axes add one below a 2-point span; numbers scale with the span. */
  private tickDecimals(span: number): number {
    if (this.o.valueFormat === 'percent') return span < 0.02 ? 1 : 0
    const r = Math.abs(span)
    return r === 0 ? 2 : r < 0.01 ? 4 : r < 0.1 ? 3 : r < 1 ? 2 : r < 10 ? 1 : 0
  }

  private summaryOn(): boolean {
    return this.o.summary === 'auto' ? this.o.valueFormat !== 'percent' : this.o.summary
  }

  private legendValue(v: number, decimals: number): string {
    return this.o.valueFormat === 'percent' && !this.customFormat ? formatLegendValue(v, decimals) : this.o.formatValue(v, decimals)
  }

  private labelMode(): LabelMode {
    if (this.o.labels !== 'auto') return this.o.labels
    return this.series.length === 2 ? 'end' : 'legend'
  }

  private computeLayout(): Layout | null {
    const width = this.width
    const height = this.o.height
    if (!width || !height) return null
    const o = this.o
    const all = this.series.flatMap((x) => x.data)
    const odds = this.labelMode()

    const yDomainOf = (): [number, number] => {
      const d: [number, number] = o.autoscale ? [min(all, (p) => p.value) || 0, max(all, (p) => p.value) || 1] : [0, 1]
      return d[1] - d[0] < Number.EPSILON
        ? [d[0] - Math.max(0.05 * Math.abs(d[0]), 0.05), d[1] + Math.max(0.05 * Math.abs(d[1]), 0.05)]
        : d
    }
    const fmtY = (v: number, span: number) => o.formatValue(v, this.tickDecimals(span))

    // margins: the y axis is as wide as its widest label + 12, min 38.
    let yAxisWidth = 0
    if (o.yAxis) {
      if (!all.length) yAxisWidth = 38
      else {
        const d = yDomainOf()
        const { ticks } = niceTicks(d)
        yAxisWidth = Math.max(38, Math.max(0, ...ticks.map((t) => measureText(fmtY(t, d[1] - d[0]), { fontSize: 12, fontFamily: 'sans-serif' }))) + 12)
      }
    }
    const margin: Margin = {
      top: 10,
      right: o.yAxis && o.yAxisOrientation === 'right' ? yAxisWidth : 0,
      bottom: o.xAxis ? 30 : 10,
      left: o.yAxis && o.yAxisOrientation === 'left' ? yAxisWidth : 0,
      ...o.margin,
    }
    const plotH = height - margin.top - margin.bottom

    // room for end labels.
    let sideOffset = 0
    let labelWidth = 0
    if (odds === 'end') {
      const mobile = isMobile()
      const maxW = o.labelMaxWidth
      if (maxW) {
        // Narrowest two-line split of each label, one shared column width.
        const widest = Math.max(0, ...this.series.map((x) => wrappedWidth(x.label, maxW)))
        labelWidth = Math.min(Math.ceil(widest + 1), maxW)
        sideOffset = Math.max(labelWidth + (mobile ? 15 : 20), mobile ? 50 : 90)
      } else {
        const longest = Math.max(0, ...this.series.map((x) => measureText(truncate(x.label, 24), { fontSize: 14, fontFamily: 'sans-serif' })))
        sideOffset = Math.max(longest + (mobile ? 15 : 20), mobile ? 50 : 90)
      }
    }

    const x = scaleTime<number, number>()
      .domain((extent(all, dateOf) as [Date, Date])[0] ? (extent(all, dateOf) as [Date, Date]) : [new Date(), new Date()])
      .range([margin.left, width - margin.right - 12 - sideOffset])
      .interpolate(interpolateRound)
    const y = scaleLinear().domain(yDomainOf()).range([plotH, 0]).nice(5).interpolate(interpolateRound)
    const { ticks: yTicks, boundMin, boundMax } = niceTicks(y.domain() as [number, number])
    y.domain([boundMin, boundMax])
    const { ticks: xTicks, format: xFormat } = timeTicks(x, o.compactTimeAxis)

    const gen = line<Point>()
      .x((p) => x(dateOf(p)) ?? 0)
      .y((p) => y(p.value) ?? 0)
      .curve(o.curve)
    const paths = new Map<string, { d: string; backfillEndX?: number }>()
    for (const sr of this.series) {
      const d = gen(sr.data) ?? ''
      if (!d || d === 'M0,0Z') continue
      const bf = sr.backfilledData
      paths.set(sr.id, { d, backfillEndX: bf.length ? x(dateOf(bf[bf.length - 1])) : undefined })
    }
    return { width, height, margin, plotH, x, y, yTicks, xTicks, xFormat, sideOffset, chartEndX: width - margin.right - 12 - sideOffset, odds, labelWidth, paths }
  }

  // ── render ─────────────────────────────────────────────────────────────

  private render() {
    this.root.dataset.pbTheme = this.theme
    const L = this.computeLayout()
    this.plot.style.height = `${this.o.height}px`
    this.renderLegend(L)
    this.renderSummary()
    this.renderWindows()
    if (!L) return
    this.layout = L
    const { width, height, margin } = L
    this.svg.setAttribute('width', String(width))
    this.svg.setAttribute('height', String(height))
    this.gPlot.setAttribute('transform', `translate(${margin.left}, ${margin.top})`)
    this.hit.setAttribute('x', String(margin.left))
    this.hit.setAttribute('width', String(width))
    this.hit.setAttribute('height', String(height))
    this.hit.style.display = this.o.interactive ? '' : 'none'
    this.renderAxes(L)
    this.renderGrid(L)
    this.renderDefs()
    this.renderLines(L)
    this.renderAttribution(L)
    this.side.style.top = `${margin.top}px`
    this.side.style.height = `${L.plotH}px`
    this.mounted = true
    this.firstRender = false
    if (this.hover) this.updateHover(this.hover.x)
    else this.renderOverlays()
  }

  private fadeIn(el: Element, duration: number, delay: number) {
    if (!this.o.animate) return
    ;(el as SVGElement).animate?.([{ opacity: 0 }, { opacity: 1 }], { duration, delay, easing: 'ease-out', fill: 'backwards' })
  }

  /** axes: tick groups with a nested <svg> carrying dx/dy, Arial 12. */
  private renderAxes(L: Layout) {
    const { width, height, margin, x, y } = L
    const o = this.o
    const tickG = (parent: SVGGElement, key: string, x1: number, y1: number, x2: number, y2: number, tx: number, ty: number, label: string, anchor: string, dx: string) => {
      const g = s('g', { class: 'pb-tick', transform: 'translate(0, 0)', 'data-key': key }, parent)
      s('line', { x1, y1, x2, y2, fill: 'transparent', 'shape-rendering': 'crispEdges', stroke: 'transparent', 'stroke-width': 1, 'stroke-linecap': 'square' }, g)
      const inner = s('svg', { x: dx, y: '0.25em', 'font-size': 12 }, g)
      inner.style.overflow = 'visible'
      const text = s('text', { x: tx, y: ty, 'font-family': 'Arial', 'font-size': 12, fill: 'var(--pb-content-secondary)', 'font-weight': 400, 'text-anchor': anchor }, inner)
      const span = s('tspan', {}, text)
      span.textContent = label
      return g
    }
    // Rebuild ticks; ones that did not exist before fade in (0.1s, 0.05s delay).
    const sync = (parent: SVGGElement, items: { key: string; make: () => SVGGElement }[], delay: number) => {
      const old = new Set([...parent.children].map((c) => c.getAttribute('data-key')))
      parent.replaceChildren()
      for (const it of items) {
        const g = it.make()
        if (!old.has(it.key) && !this.firstRender) this.fadeIn(g, 100, 50)
      }
      if (this.firstRender) this.fadeIn(parent, 200, delay)
    }

    // X axis (bottom).
    if (o.xAxis) {
      this.gXAxis.style.display = ''
      this.gXAxis.setAttribute('transform', `translate(0, ${height - margin.bottom - margin.top})`)
      let ticks = L.xTicks
      if (isMobile() && ticks.length > 2) ticks = [ticks[0], ticks[ticks.length - 1]]
      const items = ticks.flatMap((t) => {
        const px = x(t)
        const label = L.xFormat(t)
        // Labels whose estimated half-width would cross an edge are hidden.
        const est = (label.includes(':') ? 6.75 : 6.25) * label.length
        if (px <= est / 2 || px >= width - margin.right - est / 2) return []
        return [{ key: `${+t}`, make: () => tickG(this.gXAxis, `${+t}`, px, 0, px, 0, px, 12, label, 'middle', '0') }]
      })
      sync(this.gXAxis, items, 300)
    } else this.gXAxis.style.display = 'none'

    // Y axis (right or left).
    if (o.yAxis) {
      this.gYAxis.style.display = ''
      const right = o.yAxisOrientation === 'right'
      this.gYAxis.setAttribute('class', `pb-axis pb-axis-${right ? 'right' : 'left'}`)
      this.gYAxis.setAttribute('transform', `translate(${right ? width - margin.right - 4 : 15}, 0)`)
      const span = y.domain()[1] - y.domain()[0]
      const sign = right ? 1 : -1
      const items = L.yTicks.map((t) => {
        const py = y(t)
        const label = o.formatValue(t, this.tickDecimals(span))
        return { key: `${t}`, make: () => tickG(this.gYAxis, `${t}`, 0, py, 8 * sign, py, 8 * sign, py, label, right ? 'start' : 'end', '0.25em') }
      })
      sync(this.gYAxis, items, 300)
    } else this.gYAxis.style.display = 'none'
  }

  /** dotted horizontal rows (+ optional vertical columns). */
  private renderGrid(L: Layout) {
    const { width, margin, y, x, height } = L
    this.gGrid.replaceChildren()
    if (this.o.gridHorizontal) {
      const rows = s('g', { class: 'pb-grid-rows', transform: `translate(${margin.left}, 0)` }, this.gGrid)
      for (const t of L.yTicks) {
        const py = y(t)
        s('line', {
          class: 'pb-grid-line', x1: 0, y1: py, x2: width - margin.left - margin.right, y2: py, fill: 'transparent',
          'shape-rendering': 'crispEdges', stroke: 'var(--pb-gray-400)', 'stroke-width': 1, 'stroke-dasharray': '1,3',
          'stroke-opacity': 0.5, 'pointer-events': 'none',
        }, rows)
      }
      if (this.firstRender) this.fadeIn(rows, 300, 0)
    }
    if (this.o.gridVertical) {
      const cols = s('g', { class: 'pb-grid-cols' }, this.gGrid)
      for (const t of x.ticks(10)) {
        const px = x(t)
        s('line', { x1: px, y1: 0, x2: px, y2: height, stroke: 'var(--pb-gray-200)', 'stroke-width': 1, 'stroke-dasharray': '1,3', 'pointer-events': 'none', 'shape-rendering': 'crispEdges' }, cols)
      }
    }
  }

  // ── gradient ──────────────────────────────────────────────────────

  private gradient(): { start: string; end: string; last: number } | null {
    const { startColor, endColor } = this.o
    if (!startColor || !endColor) return null
    const first = this.series[0]
    const last = this.o.lastPrice ?? first?.data[first.data.length - 1]?.value
    return last === undefined ? null : { start: startColor, end: endColor, last }
  }

  /** Color for a value: the series color, or the gradient mix at that value. */
  private colorAt(fallback: string, value: number | undefined): string {
    const g = this.gradient()
    if (!g || !value) return fallback
    return mixHsl(g.start, g.end, 100 * value)
  }

  private lineStroke(sr: ResolvedSeries): string {
    return this.gradient() ? `url(#${this.uid}-path-gradient)` : sr.stroke
  }

  private renderDefs() {
    this.defs.replaceChildren()
    const g = this.gradient()
    if (g) {
      const lg = s('linearGradient', { id: `${this.uid}-path-gradient`, x1: '0%', x2: '0%', y1: '100%', y2: '0%' }, this.defs)
      s('stop', { offset: '0%', 'stop-color': g.start, 'stop-opacity': '0.5' }, lg)
      s('stop', { offset: '100%', 'stop-color': mixHsl(g.start, g.end, 100 * g.last) }, lg)
    }
    if (this.o.area) {
      const top = typeof this.o.area === 'number' ? this.o.area : 0.05
      this.series.forEach((sr, i) => {
        const lg = s('linearGradient', { id: `${this.uid}-area-${i}`, x1: '0', x2: '0', y1: '0', y2: '1' }, this.defs)
        s('stop', { offset: '0%', 'stop-color': this.colorAt(sr.stroke, this.gradient()?.last), 'stop-opacity': top }, lg)
        s('stop', { offset: '100%', 'stop-color': this.colorAt(sr.stroke, this.gradient()?.last), 'stop-opacity': 0 }, lg)
      })
    }
  }

  /** lines: underlay, main, shimmer, backfill mask + dashed, end dot. */
  private renderLines(L: Layout) {
    const seen = new Set<string>()
    for (const sr of this.series) {
      const p = L.paths.get(sr.id)
      if (!p) continue
      seen.add(sr.id)
      let e = this.els.get(sr.id)
      const isNew = !e
      if (!e) e = this.createSeriesEls(sr)
      this.updateSeriesEls(e, sr, p, isNew)
      const last = sr.data[sr.data.length - 1]
      e.dotCircle.setAttribute('cx', String(L.x(dateOf(last))))
      e.dotCircle.setAttribute('cy', String(L.y(last.value)))
      e.pulse.setAttribute('cx', String(L.x(dateOf(last))))
      e.pulse.setAttribute('cy', String(L.y(last.value)))
      const dotFill = this.gradient() ? mixHsl(this.gradient()!.start, this.gradient()!.end, 100 * this.gradient()!.last) : sr.stroke
      e.dotCircle.setAttribute('fill', dotFill)
      e.pulse.setAttribute('fill', dotFill)
      this.updateArea(e, sr, L)
    }
    for (const [id, e] of this.els) {
      if (seen.has(id)) continue
      e.cancel.forEach((c) => c())
      e.g.remove()
      e.dot.remove()
      this.els.delete(id)
    }
    // Keep series order = paint order, dots on top of all lines.
    for (const sr of this.series) {
      const e = this.els.get(sr.id)
      if (e) this.gLines.insertBefore(e.g, this.gDots)
    }
    this.gLines.appendChild(this.gDots)
  }

  private updateArea(e: SeriesEls, sr: ResolvedSeries, L: Layout) {
    if (!this.o.area) {
      e.area?.remove()
      e.area = undefined
      return
    }
    if (!e.area) {
      e.area = s('path', { stroke: 'none' })
      e.area.style.pointerEvents = 'none'
      e.g.insertBefore(e.area, e.g.firstChild)
      if (this.o.animate) e.area.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' })
    }
    const i = this.series.indexOf(sr)
    const gen = d3area<Point>()
      .x((p) => L.x(dateOf(p)) ?? 0)
      .y0(L.plotH)
      .y1((p) => L.y(p.value) ?? 0)
      .curve(this.o.curve)
    e.area.setAttribute('d', gen(sr.data) ?? '')
    e.area.setAttribute('fill', `url(#${this.uid}-area-${i})`)
    e.area.style.clipPath = e.main.style.clipPath
  }

  private createSeriesEls(sr: ResolvedSeries): SeriesEls {
    const g = s('g', { transform: 'translate(0, 0)' })
    const underlay = s('path', { 'stroke-width': 2, 'stroke-opacity': 1, fill: 'transparent', class: 'pointer-events-none', stroke: 'var(--pb-gray-100)' }, g)
    const main = s('path', { id: `${sr.id}-path`, 'shape-rendering': 'geometricPrecision', fill: 'transparent', 'stroke-opacity': 1, class: 'pointer-events-none' }, g)
    const shimmer = s('path', { id: `${sr.id}-path-shimmer`, 'stroke-width': 2.75, fill: 'transparent', class: 'pointer-events-none' }, g)
    for (const p of [underlay, main, shimmer]) p.style.pointerEvents = 'none'
    shimmer.style.strokeOpacity = '0'
    main.style.clipPath = 'inset(-13px)'
    const dot = s('g', { class: 'pointer-events-none' }, this.gDots)
    dot.style.pointerEvents = 'none'
    const dotCircle = s('circle', { r: 4 }, dot)
    const pulse = s('circle', { r: 4, opacity: 0 }, dot)
    for (const c of [dotCircle, pulse]) {
      c.style.transformOrigin = '50% 50%'
      c.style.transformBox = 'fill-box'
    }
    dot.style.display = 'none'
    const e: SeriesEls = { g, underlay, main, shimmer, dot, dotCircle, pulse, d: '', ready: !this.o.animate, cancel: [] }
    this.els.set(sr.id, e)
    // End dot mounts 350ms after the chart.
    const t = setTimeout(() => {
      e.dot.style.display = ''
      this.showDot(e, !this.hover)
    }, this.o.animate ? 350 : 0)
    e.cancel.push(() => clearTimeout(t))
    return e
  }

  private showDot(e: SeriesEls, visible: boolean) {
    e.pulseAnim?.cancel()
    e.pulseAnim = undefined
    if (!visible) {
      if (this.o.animate) e.dotCircle.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(0)', opacity: 0 }], { duration: 50, easing: 'ease-out', fill: 'forwards' })
      else e.dotCircle.style.opacity = '0'
      return
    }
    e.dotCircle.style.opacity = ''
    if (this.o.animate) e.dotCircle.animate([{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 100, easing: 'ease-out', fill: 'forwards' })
    if (this.o.pulse && this.o.animate) {
      // opacity .6→0, scale 1→4 over 2.25s, 1s pause, forever; first run after 0.7s.
      e.pulseAnim = e.pulse.animate(
        [
          { opacity: 0.6, transform: 'scale(1)', easing: 'cubic-bezier(0, 0, 0.58, 1)', offset: 0 },
          { opacity: 0, transform: 'scale(4)', offset: 2.25 / 3.25 },
          { opacity: 0, transform: 'scale(4)', offset: 1 },
        ],
        { duration: 3250, delay: 700, iterations: Infinity, fill: 'backwards' },
      )
    }
  }

  private updateSeriesEls(e: SeriesEls, sr: ResolvedSeries, p: { d: string; backfillEndX?: number }, isNew: boolean) {
    const o = this.o
    e.main.setAttribute('stroke', this.lineStroke(sr))
    e.main.setAttribute('stroke-width', String(o.strokeWidth))
    e.shimmer.setAttribute('stroke', this.lineStroke(sr))

    // Backfill layers (rows 4–5).
    const hasBackfill = p.backfillEndX !== undefined
    if (hasBackfill && !e.mask) {
      e.mask = s('path', { fill: 'transparent', 'shape-rendering': 'geometricPrecision' }, e.g)
      e.mask.style.stroke = 'var(--pb-chart-bg, var(--pb-surface))'
      e.mask.style.pointerEvents = 'none'
      e.dashed = s('path', { fill: 'transparent', 'shape-rendering': 'geometricPrecision', 'stroke-dasharray': '2 2' }, e.g)
      e.dashed.style.pointerEvents = 'none'
      if (o.animate) {
        const mask = e.mask
        setPathLength(mask, 0)
        e.cancel.push(tween({ duration: 300, ease: ease.easeOut, onUpdate: (v) => setPathLength(mask, v), onComplete: () => clearPathLength(mask) }))
        const dashed = e.dashed
        dashed.style.strokeOpacity = '0'
        e.cancel.push(tween({ duration: 175, delay: 25, ease: ease.easeIn, onUpdate: (v) => (dashed.style.strokeOpacity = String(v)) }))
      }
    } else if (!hasBackfill && e.mask) {
      e.mask.remove()
      e.dashed?.remove()
      e.mask = e.dashed = undefined
    }
    if (e.mask && e.dashed) {
      e.mask.setAttribute('stroke-width', String(o.strokeWidth))
      e.dashed.setAttribute('stroke-width', String(o.strokeWidth))
      e.dashed.setAttribute('stroke', `color-mix(in srgb, ${sr.stroke} 40%, transparent)`)
      const nums = p.d.match(/-?[\d.]+/g)
      const endX = nums && nums.length >= 2 ? parseFloat(nums[nums.length - 2]) : 0
      const clip = `inset(-13px ${endX - (p.backfillEndX ?? 0) - 1}px -13px -13px)`
      e.mask.style.clipPath = clip
      e.dashed.style.clipPath = clip
    }

    const layers = () => [e.underlay, e.main, e.shimmer, e.mask, e.dashed].filter(Boolean) as SVGPathElement[]
    const setD = (d: string) => layers().forEach((l) => l.setAttribute('d', d))

    if (isNew) {
      setD(p.d)
      e.d = p.d
      if (o.animate) {
        // entrance: underlay + main draw in, then the shimmer runs once.
        for (const l of [e.underlay, e.main]) setPathLength(l, 0)
        e.cancel.push(
          tween({
            duration: 300,
            ease: ease.easeOut,
            onUpdate: (v) => [e.underlay, e.main].forEach((l) => setPathLength(l, v)),
            onComplete: () => {
              ;[e.underlay, e.main].forEach(clearPathLength)
              e.ready = true
            },
          }),
        )
        if (o.shimmer) this.runShimmer(e)
      }
      this.gLines.appendChild(e.g)
      return
    }
    if (p.d === e.d) return
    if (!e.ready || !o.animate) {
      setD(p.d)
      e.d = p.d
      return
    }
    // path morph, 0.42s easeOutExpo.
    const interp = interpolatePath(e.d, p.d) as (t: number) => string
    e.d = p.d
    e.cancel.push(tween({ duration: 420, ease: ease.easeOutExpo, onUpdate: (t) => setD(t >= 1 ? p.d : interp(t)) }))
  }

  private runShimmer(e: SeriesEls) {
    const el = e.shimmer
    el.style.strokeOpacity = '1'
    setPathLength(el, 0, 0)
    e.cancel.push(
      tween({
        duration: 900,
        delay: 500,
        ease: ease.easeInOut,
        onUpdate: (t) => setPathLength(el, 0.1 * t, t),
        onComplete: () => {
          e.cancel.push(
            tween({
              duration: 100,
              ease: ease.easeInOut,
              onUpdate: (t) => setPathLength(el, 0.1 * (1 - t), 1),
              onComplete: () => {
                el.style.strokeOpacity = '0'
                setPathLength(el, 0, 0)
              },
            }),
          )
        },
      }),
    )
  }

  private renderAttribution(L: Layout) {
    const a = this.o.attribution
    this.attribution.style.display = a ? '' : 'none'
    if (!a) return
    this.attribution.style.left = `${L.margin.left + 4}px`
    this.attribution.style.bottom = `${L.margin.bottom + 8}px`
    ;(this.attribution.firstChild as HTMLElement).textContent = a
  }

  private renderLegend(L: Layout | null) {
    const show = !this.summaryOn() && (this.o.legend === 'auto' ? this.series.length > 1 : this.o.legend) && (L?.odds ?? this.labelMode()) === 'legend'
    this.legendRow.style.display = show ? '' : 'none'
    if (!show) return
    let list = this.legendRow.querySelector<HTMLDivElement>('.pb-legend')
    if (!list) list = h('div', 'pb-legend', this.legendRow)
    // Keyed items so a reorder (e.g. ranks change after new data) can animate:
    // FLIP from the old position, so items glide to their new place.
    const before = new Map<string, DOMRect>()
    const existing = new Map<string, HTMLDivElement>()
    for (const el of [...list.children] as HTMLDivElement[]) {
      existing.set(el.dataset.id!, el)
      before.set(el.dataset.id!, el.getBoundingClientRect())
    }
    const keep = new Set<string>()
    for (const sr of this.series) {
      keep.add(sr.id)
      let item = existing.get(sr.id)
      if (!item) {
        item = h('div', 'pb-legend-item')
        item.dataset.id = sr.id
        h('i', '', item)
        const p = h('p', '', item)
        p.append('')
        h('b', '', p)
        if (this.o.animate && !this.firstRender) item.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' })
      }
      ;(item.firstElementChild as HTMLElement).style.background = sr.stroke
      const p = item.querySelector('p')!
      p.firstChild!.textContent = sr.label
      p.querySelector('b')!.textContent = `\u00a0${this.legendValue(sr.data[sr.data.length - 1].value, sr.decimals)}`
      list.appendChild(item)
    }
    for (const [id, el] of existing) if (!keep.has(id)) el.remove()
    if (this.o.animate) {
      for (const el of [...list.children] as HTMLDivElement[]) {
        const prev = before.get(el.dataset.id!)
        if (!prev) continue
        const now = el.getBoundingClientRect()
        const dx = prev.left - now.left
        const dy = prev.top - now.top
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue
        // spring, duration .3 bounce .05 ≈ this curve
        el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.25,.9,.3,1)' })
      }
    }
    let box = this.legendRow.querySelector<HTMLDivElement>('.pb-watermark')
    const wm = this.o.watermark
    if (!wm) box?.remove()
    else {
      box ??= h('div', 'pb-watermark', this.legendRow)
      box.replaceChildren()
      if (typeof wm === 'string') box.innerHTML = wm
      else box.appendChild(wm.cloneNode(true))
    }
  }

  /** Big current value + change over the range (number charts, or `summary: true`). */
  private renderSummary() {
    const on = this.summaryOn() && this.series.length > 0
    this.summaryEl.style.display = on ? '' : 'none'
    if (!on) return
    const sr = this.series[0]
    const hovered = this.hover?.data.find((p) => p.id === sr.id)?.point.value
    const value = hovered ?? sr.data[sr.data.length - 1].value
    const change = sr.data[sr.data.length - 1].value - sr.data[0].value
    const parts = summaryParts(value, change, this.o.valueFormat, this.o.unit)
    const dir = change > 0 ? 'up' : change < 0 ? 'down' : 'flat'
    const caret = dir === 'up' ? 'M6.52 2.5c-.23-.4-.81-.4-1.04 0L1.84 8.8c-.23.4.06.9.52.9h7.28c.46 0 .75-.5.52-.9L6.52 2.5Z' : 'M6.52 9.5c-.23.4-.81.4-1.04 0L1.84 3.2c-.23-.4.06-.9.52-.9h7.28c.46 0 .75.5.52.9L6.52 9.5Z'
    this.summaryEl.innerHTML = `<span class="pb-summary-value" style="color:${sr.stroke}"></span>${dir === 'flat' ? '' : `<span class="pb-change pb-${dir}"><svg width="12" height="12" viewBox="0 0 12 12"><path fill="currentColor" d="${caret}"/></svg><span></span></span>`}`
    ;(this.summaryEl.firstElementChild as HTMLElement).textContent = parts.value
    const c = this.summaryEl.querySelector('.pb-change span')
    if (c) c.textContent = parts.change
  }

  private renderWindows() {
    this.windows.style.display = this.o.timeWindows ? '' : 'none'
    if (!this.o.timeWindows) return
    this.windows.replaceChildren()
    for (const w of this.o.windows.length ? this.o.windows : WINDOWS) {
      const b = h('button', '', this.windows)
      b.type = 'button'
      b.textContent = w.label
      b.setAttribute('aria-pressed', String(this.o.window === w.key))
      b.onclick = () => this.setWindow(w.key)
    }
  }

  // ── interaction ────────────────────────────────────────────────────

  private bindEvents() {
    const svgX = (ev: { clientX: number }) => ev.clientX - this.svg.getBoundingClientRect().left
    const narrow = () => isMobile()

    this.hit.addEventListener('mousemove', (ev) => {
      if (narrow() || this.drag.locked) return
      const x = svgX(ev)
      const now = performance.now()
      // 16ms throttle, trailing edge via rAF.
      if (now - this.lastMove >= 16) {
        this.lastMove = now
        this.updateHover(x)
      } else {
        cancelAnimationFrame(this.moveFrame)
        this.moveFrame = requestAnimationFrame(() => {
          this.lastMove = performance.now()
          this.updateHover(x)
        })
      }
      const d = this.drag
      if (this.o.dragRange && d.pending && !d.active && Math.abs(ev.clientX - d.downX) > 3 && this.hover) {
        d.active = true
        this.renderOverlays()
      }
    })
    this.hit.addEventListener('mousedown', (ev) => {
      if (narrow() || this.drag.locked || !this.o.dragRange) return
      const d = this.drag
      d.pending = true
      d.active = false
      d.downX = ev.clientX
      d.anchorX = this.hover?.x ?? svgX(ev)
      d.anchorData = this.hover ? [...this.hover.data] : null
      const up = () => {
        window.removeEventListener('mouseup', up)
        if (!d.pending) return
        d.pending = false
        if (d.active) {
          d.locked = true
          d.suppressClick = true
        }
      }
      window.addEventListener('mouseup', up)
    })
    this.hit.addEventListener('mouseleave', () => {
      if (narrow()) return
      cancelAnimationFrame(this.moveFrame)
      if (this.drag.active || this.drag.locked) return
      this.drag.pending = false
      this.resetHover()
    })
    this.hit.addEventListener('click', () => {
      const d = this.drag
      if (d.suppressClick) {
        d.suppressClick = false
        return
      }
      if (d.locked) {
        this.clearDrag()
        this.resetHover()
        return
      }
      const t = this.hover?.data[0]?.point.time
      if (this.o.clickToCopy && t) navigator.clipboard?.writeText(String(t)).catch(() => {})
    })

    // Touch: 200ms long-press, then scrub (mobile).
    let pressTimer = 0
    let scrubbing = false
    let startY = 0
    this.hit.addEventListener('touchstart', (ev) => {
      if (!narrow()) return
      startY = ev.touches[0].clientY
      const x = svgX(ev.touches[0])
      pressTimer = window.setTimeout(() => {
        scrubbing = true
        document.body.style.overflow = 'hidden'
        this.updateHover(x)
      }, 200)
    }, { passive: true })
    this.hit.addEventListener('touchmove', (ev) => {
      if (!scrubbing) {
        if (Math.abs(ev.touches[0].clientY - startY) > 20) clearTimeout(pressTimer)
        return
      }
      ev.preventDefault()
      this.updateHover(svgX(ev.touches[0]))
    }, { passive: false })
    const end = () => {
      clearTimeout(pressTimer)
      if (scrubbing) {
        scrubbing = false
        document.body.style.overflow = ''
      }
      if (narrow()) this.resetHover()
    }
    this.hit.addEventListener('touchend', end)
    this.hit.addEventListener('touchcancel', end)
  }

  private clearDrag() {
    Object.assign(this.drag, { pending: false, active: false, locked: false, anchorData: null })
  }

  private pointsAt(x: number): Hover | null {
    const L = this.layout
    if (!L) return null
    const t = L.x.invert(x)
    const data: HoverPoint[] = []
    const tops: number[] = []
    for (const sr of this.series) {
      const i = bisectDate(sr.data, t, 1)
      const a = sr.data[i - 1]
      const b = sr.data[i]
      let p = a
      if (b && a) p = +t - +dateOf(a) > +dateOf(b) - +t ? b : a
      if (!p) continue
      data.push({ id: sr.id, label: sr.label, color: sr.stroke, decimals: sr.decimals, point: p })
      // A value of exactly 0 maps to the domain top.
      tops.push(L.y(p.value ? p.value : L.y.domain()[1]))
    }
    return { x, data, tops }
  }

  private updateHover(x: number) {
    const wasOpen = !!this.hover
    this.hover = this.pointsAt(x)
    if (!wasOpen && this.hover) for (const e of this.els.values()) if (e.dot.style.display !== 'none') this.showDot(e, false)
    this.renderOverlays()
    const hv = this.hover
    this.o.onHover?.(hv?.data ?? null, hv?.data[0] ? dateOf(hv.data[0].point) : null)
  }

  private resetHover() {
    if (!this.hover) return
    this.hover = null
    this.clearDrag()
    for (const e of this.els.values()) if (e.dot.style.display !== 'none') this.showDot(e, true)
    this.renderOverlays()
    this.o.onHover?.(null, null)
  }

  /** Crosshair, markers, clip, date tip, pills / side labels. */
  private renderOverlays() {
    const L = this.layout
    if (!L) return
    const { width, margin, chartEndX } = L
    const hv = this.hover
    const d = this.drag
    const open = !!hv && !!hv.x
    const inRange = !!hv && hv.x <= chartEndX
    const cx = hv ? Math.min(hv.x, chartEndX) : 0
    const endOffset = L.odds === 'end' ? L.sideOffset : 0

    // Crosshair + drag anchor line.
    const y1 = margin.top - 28
    const y2 = L.height - margin.bottom - 4
    const setLine = (l: SVGLineElement, x: number, show: boolean) => {
      const was = l.style.display !== 'none'
      l.style.display = show ? '' : 'none'
      if (!show) return
      l.setAttribute('x1', String(x)); l.setAttribute('x2', String(x))
      l.setAttribute('y1', String(y1)); l.setAttribute('y2', String(y2))
      if (!was) this.fadeIn(l, 125, 20)
    }
    setLine(this.crosshair, cx, open && inRange)
    setLine(this.anchorLine, Math.min(d.anchorX, chartEndX), d.active)

    // Markers.
    const hadMarkers = this.gMarkers.childElementCount > 0
    this.gMarkers.replaceChildren()
    if (open && hv) {
      hv.data.forEach((p, i) => {
        const c = s('circle', { id: `${p.id}-tooltip-circle`, cx, cy: (hv.tops[i] ?? 0) + 1, r: 4, fill: this.colorAt(p.color, hv.data[0]?.point.value), 'fill-opacity': 1, stroke: this.colorAt(p.color, hv.data[0]?.point.value), 'stroke-opacity': 0.1, 'stroke-width': 2, 'pointer-events': 'none' }, this.gMarkers)
        if (!hadMarkers) this.fadeIn(c, 125, 50)
      })
    }

    // hover clip; drag clips both ends.
    for (const [id, e] of this.els) {
      if (d.active && hv) {
        const pd = L.paths.get(id)?.d ?? ''
        const nums = pd.match(/-?[\d.]+/g)
        const startX = nums ? parseFloat(nums[0]) : margin.left
        const endX = nums && nums.length >= 2 ? parseFloat(nums[nums.length - 2]) : width - margin.right
        const a = Math.min(d.anchorX, chartEndX)
        const b = Math.min(hv.x, chartEndX)
        e.main.style.clipPath = `inset(-13px ${endX - Math.max(a, b)}px -13px ${Math.min(a, b) - startX}px)`
        if (e.area) e.area.style.clipPath = e.main.style.clipPath
      }
    }
    if (!d.active) {
      const target = open && hv ? width - margin.right - (hv.x + endOffset) - 10 : -13
      if (open) {
        this.clipCancel?.()
        this.clip = target
        this.applyClip()
      } else if (this.clip !== target) {
        this.clipCancel?.()
        this.clipCancel = spring({ from: this.clip, to: target, stiffness: 1300, damping: 65, onUpdate: (v) => { this.clip = v; this.applyClip() } })
      }
    }

    this.renderDateTip(L)
    if (this.summaryOn()) this.renderSummary()
    if (L.odds === 'legend') {
      this.side.replaceChildren()
      this.renderPills(L)
    } else {
      this.pills.replaceChildren()
      this.renderSide(L)
    }
  }

  private applyClip() {
    const v = this.clip
    const css = v === -13 ? 'inset(-13px)' : `inset(-13px ${v}px -13px -13px)`
    for (const e of this.els.values()) {
      e.main.style.clipPath = css
      if (e.area) e.area.style.clipPath = css
    }
  }

  private renderDateTip(L: Layout) {
    const hv = this.hover
    const tip = this.dateTip
    const { width, margin, chartEndX } = L
    const show = !!hv && hv.x <= chartEndX && !!hv.data[0]
    if (!show || !hv) {
      tip.classList.remove('pb-on')
      tip.classList.add('pb-off')
      return
    }
    const d = this.drag
    const date = dateOf(hv.data[0].point)
    let text = this.o.formatDate(date)
    if (d.active && d.anchorData?.[0]) {
      const a = dateOf(d.anchorData[0].point)
      const [lo, hi] = a < date ? [a, date] : [date, a]
      text = `${formatDate(lo, 'MMM d, yyyy')} - ${formatDate(hi, 'MMM d, yyyy')}`
    }
    if (tip.textContent !== text) tip.textContent = text
    const w = tip.getBoundingClientRect().width
    const R = width - margin.right - margin.left - 20
    const flip = hv.x > width - margin.right - margin.left - 16 - this.largestLabelWidth
    let left: number
    if (d.active) left = Math.max(0, Math.min((d.anchorX + hv.x) / 2 - w / 2, R))
    else if (flip) left = Math.min(hv.x - 12 - w, R - w + 4)
    else left = Math.min(hv.x + 8, R)
    // Wrapped end labels: the date sits 6px above the top label instead of the chart top.
    let top = -24
    if (L.odds === 'end' && L.labelWidth) {
      const { boxes } = this.sideLayout(L)
      if (boxes.length) top = margin.top + boxes[0].adj - tip.getBoundingClientRect().height - DATE_LABEL_GAP
    }
    tip.style.top = `${top}px`
    const wasOn = tip.classList.contains('pb-on')
    tip.classList.add('pb-on')
    tip.classList.remove('pb-off')
    if (!wasOn || !this.o.animate) {
      this.dateLeftCancel?.()
      this.dateLeft = left
      tip.style.left = `${left}px`
    } else {
      this.dateLeftCancel?.()
      this.dateLeftCancel = spring({ from: this.dateLeft, to: left, stiffness: 500, damping: 40, mass: 0.8, onUpdate: (v) => { this.dateLeft = v; tip.style.left = `${v}px` } })
    }
  }

  /** hover pills next to the cursor, de-overlapped by value. */
  private renderPills(L: Layout) {
    const hv = this.hover
    this.pills.replaceChildren()
    if (!hv || hv.x > L.chartEndX || !hv.data.length) return
    const { width, margin, y } = L
    const dom = y.domain()
    const span = dom[1] - dom[0] === 0 ? 0.002 : dom[1] - dom[0]
    const minDiff = 0.1 * span
    const sorted = [...hv.data].sort((a, b) => (a.point.value > b.point.value ? 1 : -1))
    const adjusted: number[] = []
    sorted.forEach((p, i) => {
      const floor = (i > 0 ? adjusted[i - 1] : -Infinity) + minDiff
      let c = p.point.value
      if (c < floor) c = floor + 0.002
      if (i === sorted.length - 1) c = Math.min(c, sorted[0].point.value + span)
      adjusted.push(c)
    })
    const maxLeft = width - margin.right - margin.left - 20
    const flip = hv.x > width - margin.right - margin.left - 16 - this.largestLabelWidth
    const anchor = this.drag.active ? this.drag.anchorData : null
    sorted.forEach((p, i) => {
      const item = h('div', 'pb-pill', this.pills)
      item.id = `label-tooltip-${p.label}`
      const box = h('div', '', item)
      const bar = h('i', '', box)
      bar.style.backgroundColor = this.colorAt(p.color, p.point.value)
      if (p.label) h('p', '', box).textContent = p.label
      h('p', '', box).textContent = this.o.formatValue(p.point.value, p.decimals)
      const a = anchor?.find((x) => x.id === p.id)
      if (a) {
        const diff = p.point.value - a.point.value
        const pct = Math.round(100 * Math.abs(diff))
        if (pct) {
          const badge = h('span', 'pb-diff', box)
          badge.style.color = diff >= 0 ? '#22C55E' : '#EF4444'
          badge.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path fill="currentColor" d="${diff >= 0 ? 'M6.51952 2.5C6.28858 2.1 5.71123 2.1 5.48029 2.5L1.84298 8.8C1.61204 9.2 1.90072 9.7 2.3626 9.7L9.63721 9.7C10.0991 9.7 10.3878 9.2 10.1568 8.8L6.51952 2.5Z' : 'M6.51952 9.5C6.28858 9.9 5.71123 9.9 5.48029 9.5L1.84298 3.2C1.61204 2.8 1.90072 2.3 2.3626 2.3L9.63721 2.3C10.0991 2.3 10.3878 2.8 10.1568 3.2L6.51952 9.5Z'}"/></svg>${pct}%`
        }
      }
      const w = box.getBoundingClientRect().width
      if (w > this.largestLabelWidth) this.largestLabelWidth = w
      const left = flip ? Math.min(hv.x - 8 - w, maxLeft - w) : Math.min(hv.x + 8, maxLeft)
      item.style.left = `${left}px`
      // Linear mapping, not rounded like the y scale.
      const [d0, d1] = y.domain()
      const [r0, r1] = y.range()
      const py = d1 === d0 ? r0 : r0 + ((adjusted[i] - d0) / (d1 - d0)) * (r1 - r0)
      item.style.transform = `translateY(${py - 10}px)`
      if (!this.o.animate) item.style.animation = 'none'
    })
  }

  /**
   * End-label positions. Default: 30px boxes kept 55px apart and clamped to the
   * plot. With `labelMaxWidth`: 40/54px boxes (one or two lines), stacked 2px apart.
   */
  private sideLayout(L: Layout) {
    const hv = this.hover
    const { plotH, chartEndX, y } = L
    type Item = { id: string; label: string; color: string; value: number; decimals: number; y: number }
    let items: Item[]
    if (hv && hv.data.length && hv.tops.length) {
      items = hv.data
        .map((p, i) => ({ id: p.id, label: p.label, color: p.color, value: p.point.value, decimals: p.decimals, y: hv.tops[i] }))
        .filter((it) => it.y >= 0 && it.y <= L.height)
    } else {
      items = this.series.map((sr) => {
        const last = sr.data[sr.data.length - 1]
        return { id: sr.id, label: sr.label, color: sr.stroke, value: last.value, decimals: sr.decimals, y: y(last.value) }
      })
    }
    const sorted = [...items].sort((a, b) => a.y - b.y)
    const x = (hv && hv.data.length ? Math.min(hv.x, chartEndX) : chartEndX) + SIDE_ODDS_X_OFFSET

    if (L.labelWidth) {
      const boxes = sorted.map((it) => {
        const h = measureText(it.label, LABEL_FONT) > L.labelWidth ? TWO_LINE_HEIGHT : ONE_LINE_HEIGHT
        return { it, h, adj: Math.min(it.y - h / 2, plotH - h) }
      })
      for (let i = 1; i < boxes.length; i++) boxes[i].adj = Math.max(boxes[i].adj, boxes[i - 1].adj + boxes[i - 1].h + WRAPPED_GAP)
      const last = boxes[boxes.length - 1]
      if (last) last.adj = Math.min(last.adj, plotH - last.h)
      for (let i = boxes.length - 2; i >= 0; i--) boxes[i].adj = Math.min(boxes[i].adj, boxes[i + 1].adj - boxes[i].h - WRAPPED_GAP)
      return { x, boxes }
    }

    const boxes = sorted.map((it) => ({ it, h: LABEL_HEIGHT, adj: Math.max(Math.min(it.y - LABEL_HEIGHT / 2, plotH - LABEL_HEIGHT - BOTTOM_MARGIN), TOP_MARGIN) }))
    let moved = true
    for (let iter = 0; moved && iter < 10; iter++) {
      moved = false
      for (let i = 1; i < boxes.length; i++) {
        const t = boxes[i]
        const r = boxes[i - 1]
        const o = r.adj + MIN_DISTANCE - t.adj
        if (o > 0) {
          moved = true
          const n = Math.max(TOP_MARGIN, r.adj - o / 2)
          const a = r.adj - n
          r.adj = n
          t.adj += o - a
        }
      }
      for (let i = 0; i < boxes.length; i++) {
        const r = boxes[i]
        if (r.adj < TOP_MARGIN) {
          r.adj = TOP_MARGIN
          for (let j = i + 1; j < boxes.length; j++) boxes[j].adj = Math.max(boxes[j].adj, boxes[j - 1].adj + MIN_DISTANCE)
        }
        const lim = plotH - LABEL_HEIGHT - BOTTOM_MARGIN
        if (r.adj > lim) {
          r.adj = lim
          for (let j = i - 1; j >= 0; j--) boxes[j].adj = Math.min(boxes[j].adj, boxes[j + 1].adj - MIN_DISTANCE)
        }
      }
    }
    for (let i = 1; i < boxes.length; i++) {
      const m = boxes[i - 1].adj + MIN_DISTANCE
      if (boxes[i].adj < m) boxes[i].adj = m
    }
    return { x, boxes }
  }

  /** End-of-line labels; they follow the cursor while hovering. */
  private renderSide(L: Layout) {
    const { x, boxes } = this.sideLayout(L)
    const wrapped = !!L.labelWidth

    const existing = new Map([...this.side.children].map((c) => [(c as HTMLElement).dataset.id ?? '', c as HTMLElement]))
    const keep = new Set<string>()
    for (const { it, adj } of boxes) {
      keep.add(it.id)
      let el = existing.get(it.id)
      if (!el) {
        el = h('div', 'pb-side-item', this.side)
        el.dataset.id = it.id
        const col = h('div', wrapped ? 'pb-wrapped' : '', el)
        h('span', 'pb-side-name', col)
        h('span', 'pb-side-value', col)
        el.style.transform = `translate(${x}px, ${adj}px)`
        if (this.o.animate) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 })
      }
      if (!this.o.animate) el.style.transition = 'none'
      el.style.transform = `translate(${x}px, ${adj}px)`
      const [name, value] = el.firstElementChild!.children as unknown as HTMLElement[]
      name.style.color = value.style.color = this.colorAt(it.color, it.value)
      ;(el.firstElementChild as HTMLElement).className = wrapped ? 'pb-wrapped' : ''
      name.style.width = wrapped ? `${L.labelWidth}px` : ''
      name.style.maxWidth = wrapped ? `${this.o.labelMaxWidth}px` : ''
      name.textContent = wrapped ? it.label : truncate(it.label, 35)
      value.textContent = this.o.formatValue(it.value, it.decimals)
    }
    for (const [id, el] of existing) if (!keep.has(id)) el.remove()
  }
}

