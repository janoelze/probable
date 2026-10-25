// OutcomeBars: a ranked list of outcomes with horizontal bars, values and
// change badges. Motion follows the other charts: bars draw in like a
// sparkline (600ms easeOutCubic), updates morph like chart paths (420ms
// easeOutExpo, continuing from wherever the bar is), and the number counts
// in the same tween as its bar.

import { injectStyles, resolveColor, watchTheme, PALETTE_ORDER, type ThemeName, type ThemeOption } from './theme'
import { formatValue } from './format'
import { tween, ease, type Cancel } from './motion'

export interface Outcome {
  /** Stable key; rows animate by id across updates. */
  id: string
  label: string
  /** 0..1 for percent, any number otherwise. */
  value: number
  /** Palette key or CSS color; defaults to the palette in rank order. */
  color?: string
  /** Change since some reference (same unit as value), shown as ▲/▼ badge. */
  change?: number
}

export interface OutcomeBarsOptions {
  items?: Outcome[]
  /** Sort by value (descending) or keep the given order. */
  sort?: 'value' | 'none'
  /** Show at most this many rows (0 = all). */
  limit?: number
  /** `percent` (0..1) or plain numbers; bars are relative to the largest value for numbers. */
  valueFormat?: 'percent' | 'number' | 'currency'
  /** Decimals for values. */
  decimals?: number
  /** Show change badges when items have `change`. */
  showChange?: boolean
  /** Below this value (percent mode) show "<1%". */
  floor?: number
  /** Bar height in px. */
  barHeight?: number
  theme?: ThemeOption
  animate?: boolean
  /** Custom value formatter. */
  formatValue?: (v: number, decimals: number) => string
  onSelect?: (item: Outcome) => void
}

export const OUTCOME_BARS_DEFAULTS = {
  items: [] as Outcome[],
  sort: 'value' as 'value' | 'none',
  limit: 0,
  valueFormat: 'percent' as 'percent' | 'number' | 'currency',
  decimals: 0,
  showChange: true,
  floor: 0.01,
  barHeight: 6,
  theme: 'light' as ThemeOption,
  animate: true,
}

const CARET_UP = 'M6.52 2.5c-.23-.4-.81-.4-1.04 0L1.84 8.8c-.23.4.06.9.52.9h7.28c.46 0 .75-.5.52-.9L6.52 2.5Z'
const CARET_DOWN = 'M6.52 9.5c-.23.4-.81.4-1.04 0L1.84 3.2c-.23-.4.06-.9.52-.9h7.28c.46 0 .75.5.52.9L6.52 9.5Z'

export class OutcomeBars {
  readonly el: HTMLElement
  private o: typeof OUTCOME_BARS_DEFAULTS & Pick<OutcomeBarsOptions, 'formatValue' | 'onSelect'>
  private root: HTMLDivElement
  private theme: ThemeName
  private stopTheme: () => void
  /** Currently displayed value and bar fraction per row (mid-animation aware). */
  private shown = new Map<string, { value: number; frac: number }>()
  private cancels = new Map<string, Cancel>()
  private first = true

  /** Renders into `el`. */
  constructor(el: HTMLElement, options: OutcomeBarsOptions = {}) {
    injectStyles(el.ownerDocument)
    this.el = el
    this.o = { ...OUTCOME_BARS_DEFAULTS, ...options }
    this.root = document.createElement('div')
    this.root.className = 'pb-root pb-bars'
    el.appendChild(this.root)
    const t = watchTheme(this.o.theme, (th) => ((this.theme = th), this.render()))
    this.theme = t.theme
    this.stopTheme = t.stop
    this.render()
  }

  /** Replace the outcomes; rows reorder and values tween. */
  setItems(items: Outcome[]) {
    this.o.items = items
    this.render()
  }

  /** Merge options and re-render. */
  setOptions(o: Partial<OutcomeBarsOptions>) {
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

  /** Remove the list. */
  destroy() {
    this.stopTheme()
    this.cancels.forEach((c) => c())
    this.root.remove()
  }

  private fmt(v: number): string {
    const o = this.o
    if (o.formatValue) return o.formatValue(v, o.decimals)
    if (o.valueFormat === 'percent' && v > 0 && v < o.floor) return `<${Math.round(o.floor * 100)}%`
    return formatValue(v, o.decimals, o.valueFormat)
  }

  private fmtChange(c: number): string {
    const o = this.o
    if (o.valueFormat === 'percent') return `${Math.round(Math.abs(c) * 100)}%`
    return formatValue(Math.abs(c), 0, o.valueFormat)
  }

  private render() {
    const o = this.o
    this.root.dataset.pbTheme = this.theme
    let items = [...o.items]
    if (o.sort === 'value') items.sort((a, b) => b.value - a.value)
    if (o.limit) items = items.slice(0, o.limit)
    const max = o.valueFormat === 'percent' ? 1 : Math.max(...items.map((i) => Math.abs(i.value)), 1e-9)

    // FLIP: remember where rows were before the reorder.
    const before = new Map<string, number>()
    const existing = new Map<string, HTMLDivElement>()
    for (const row of [...this.root.children] as HTMLDivElement[]) {
      existing.set(row.dataset.id!, row)
      before.set(row.dataset.id!, row.getBoundingClientRect().top)
    }
    const keep = new Set<string>()
    items.forEach((it, rank) => {
      keep.add(it.id)
      let row = existing.get(it.id)
      const isNew = !row
      if (!row) {
        row = document.createElement('div')
        row.className = 'pb-bar-row'
        row.dataset.id = it.id
        row.innerHTML = `<div class="pb-bar-head"><span class="pb-bar-label"></span><span class="pb-bar-change"></span><span class="pb-bar-value"></span></div><div class="pb-bar-track"><i></i></div>`
        if (o.animate && !this.first) row.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' })
      }
      row.onclick = o.onSelect ? () => o.onSelect!(it) : null
      row.style.cursor = o.onSelect ? 'pointer' : ''
      const color = resolveColor(it.color ?? PALETTE_ORDER[rank % PALETTE_ORDER.length], this.theme)
      ;(row.querySelector('.pb-bar-label') as HTMLElement).textContent = it.label
      const track = row.querySelector('.pb-bar-track') as HTMLElement
      track.style.height = `${o.barHeight}px`
      const fill = track.firstElementChild as HTMLElement
      fill.style.background = color
      const frac = Math.max(0, Math.min(1, Math.abs(it.value) / max))

      const ch = row.querySelector('.pb-bar-change') as HTMLElement
      const c = it.change ?? 0
      if (o.showChange && it.change !== undefined && Math.round(Math.abs(c) * (o.valueFormat === 'percent' ? 100 : 1)) !== 0) {
        ch.className = `pb-bar-change pb-${c > 0 ? 'up' : 'down'}`
        ch.innerHTML = `<svg width="10" height="10" viewBox="0 0 12 12"><path fill="currentColor" d="${c > 0 ? CARET_UP : CARET_DOWN}"/></svg><span></span>`
        ;(ch.lastElementChild as HTMLElement).textContent = this.fmtChange(c)
      } else {
        ch.className = 'pb-bar-change'
        ch.innerHTML = ''
      }
      this.animateRow(it.id, fill, row.querySelector('.pb-bar-value') as HTMLElement, it.value, frac)
      this.root.appendChild(row)
    })
    for (const [id, row] of existing) if (!keep.has(id)) row.remove()
    if (o.animate) {
      for (const row of [...this.root.children] as HTMLDivElement[]) {
        const prev = before.get(row.dataset.id!)
        if (prev === undefined) continue
        const dy = prev - row.getBoundingClientRect().top
        if (Math.abs(dy) > 0.5) row.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.25,.9,.3,1)' })
      }
    }
    this.first = false
  }

  /**
   * Bar width and number in one tween. New rows draw in from zero (600ms
   * easeOutCubic); changed rows morph from their current state (420ms easeOutExpo).
   */
  private animateRow(id: string, fill: HTMLElement, label: HTMLElement, value: number, frac: number) {
    const from = this.shown.get(id)
    this.cancels.get(id)?.()
    const apply = (v: number, f: number) => {
      this.shown.set(id, { value: v, frac: f })
      fill.style.width = `${f * 100}%`
      label.textContent = this.fmt(v)
    }
    if (!this.o.animate || (from && from.value === value && from.frac === frac)) return apply(value, frac)
    const start = from ?? { value, frac: 0 }
    this.cancels.set(
      id,
      tween({
        duration: from ? 420 : 600,
        ease: from ? ease.easeOutExpo : ease.easeOutCubic,
        onUpdate: (t) => apply(from ? start.value + (value - start.value) * t : value, start.frac + (frac - start.frac) * t),
      }),
    )
  }
}
