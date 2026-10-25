// Series types and helpers for preparing time series before rendering.

import { PALETTE, PALETTE_ORDER } from './theme'

export interface Point {
  /** Unix seconds. */
  time: number
  /** Probability 0..1 (or any number with `valueFormat: 'number'`). */
  value: number
}

export interface Series {
  /** Stable key; animations follow it across updates. */
  id: string
  /** Shown in end labels, legend and pills. */
  label: string
  /** Palette key (`light-blue`, `blue`, …), `#hex`, `"#light,#dark"` or any CSS color. */
  color: string
  /** Points sorted by time. */
  data: Point[]
  /** Points carried backwards before the series existed; drawn dashed (see `backfill()`). */
  backfilledData?: Point[]
  /** Decimals for this series' percent labels (0 → "17%", 1 → "17.4%"). */
  decimals?: number
}

/**
 * Assigns palette colors in order: an item's own `color` (a palette key) wins,
 * everyone else takes the lowest free palette slot.
 */
export function assignColors<T extends { color?: string }>(items: T[], palette: string[] = PALETTE_ORDER): (T & { color: string })[] {
  const free = palette.filter((k) => !items.some((i) => i.color === k))
  return items.map((i) => {
    if (i.color && (PALETTE[i.color] || palette.includes(i.color))) return { ...i, color: i.color }
    return { ...i, color: free.shift() ?? 'blue' }
  })
}

/**
 * Puts all series on one shared timeline and carries each series' first value
 * back to the start. The carried points are returned separately so the chart
 * can draw them dashed.
 */
export function backfill(list: Point[][]): { data: Point[]; backfilled: Point[] }[] {
  const times = [...new Set(list.flatMap((d) => d.map((p) => p.time)))].sort((a, b) => a - b)
  return list.map((d) => {
    const byTime = new Map(d.map((p) => [p.time, p.value]))
    const data: Point[] = []
    const backfilled: Point[] = []
    let last = d.length ? d[0].value : 0.001
    let first: number | undefined
    for (const t of times) {
      if (byTime.has(t)) {
        last = byTime.get(t)!
        data.push({ time: t, value: last })
        if (first === undefined) first = t
      } else if (first === undefined || t < first) {
        backfilled.push({ time: t, value: last })
        data.push({ time: t, value: last })
      }
    }
    return { data, backfilled }
  })
}

/** Appends `{ time: now, value }` when it is newer than the last point (e.g. a live quote). */
export function appendLatest(data: Point[], value: number | undefined, now = Math.floor(Date.now() / 1000)): Point[] {
  if (value == null || !Number.isFinite(value)) return data
  const last = data.length ? data[data.length - 1].time : 0
  return now > last ? [...data, { time: now, value }] : data
}

/** Extends every series flat to the latest timestamp so all lines end together. */
export function alignEnds<T extends { data: Point[] }>(series: T[]): T[] {
  if (series.length < 2) return series
  const end = Math.max(...series.map((s) => (s.data.length ? s.data[s.data.length - 1].time : -Infinity)))
  if (!Number.isFinite(end)) return series
  return series.map((s) => {
    const l = s.data[s.data.length - 1]
    return l && l.time < end ? { ...s, data: [...s.data, { time: end, value: l.value }] } : s
  })
}
