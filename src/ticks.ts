// Axis tick logic.

import { timeMinute, timeHour, timeDay, timeWeek, timeMonth, timeSecond, type CountableTimeInterval, type TimeInterval } from 'd3-time'
import type { ScaleTime } from 'd3-scale'
import { formatDate } from './format'

export const Y_AXIS_STEP_SIZES = [0.01, 0.02, 0.03, 0.04, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5]
export const Y_AXIS_PREFERRED_TICK_RANGE = { min: 4, max: 6 }
export const Y_AXIS_FALLBACK_TICK_RANGE = { min: 3, max: 7 }

function pickStep(span: number, steps: number[], min: number, max: number) {
  let step = 0
  let count = 0
  for (const s of steps) {
    const c = Math.floor(span / s) + 1
    if (c >= min && c <= max && (c === 5 || (count !== 5 && c > count))) {
      step = s
      count = c
      if (c === 5) break
    }
  }
  return count > 0 ? { step, count } : null
}

/** Y ticks: prefers exactly five, widens the domain to whole steps. */
export function niceTicks([lo, hi]: [number, number]): { ticks: number[]; boundMin: number; boundMax: number } {
  const span0 = hi - lo
  if (span0 <= 0) return { ticks: [lo], boundMin: lo, boundMax: hi }
  const q = 10 ** Math.floor(Math.log10(span0)) / 20
  const a = Math.floor(lo / q) * q
  const b = Math.ceil(hi / q) * q
  const span = b - a
  const mag = Math.floor(Math.log10(span))
  const set = new Set<number>()
  for (let e = mag - 1; e <= mag + 1; e++) for (const s of Y_AXIS_STEP_SIZES) set.add(s * 10 ** e)
  const steps = [...set].sort((x, y) => x - y)
  const r =
    pickStep(span, steps, Y_AXIS_PREFERRED_TICK_RANGE.min, Y_AXIS_PREFERRED_TICK_RANGE.max) ??
    pickStep(span, steps, Y_AXIS_FALLBACK_TICK_RANGE.min, Y_AXIS_FALLBACK_TICK_RANGE.max)
  const step = r?.step ?? span0 / 5
  const dec = step >= 1 ? 0 : Math.max(0, -Math.floor(Math.log10(step)) + 1)
  const ticks: number[] = []
  for (let v = a; v <= b + 0.001 * step; v += step) {
    ticks.push(parseFloat(v.toFixed(dec)))
    if (ticks.length > 20) break
  }
  return { ticks, boundMin: a, boundMax: b }
}

type DateFormatter = (d: Date) => string
const fmt = (p: string): DateFormatter => (d) => formatDate(d, p)

// Every-other-day interval anchored at 2000-01-01.
const ANCHOR = new Date(2000, 0, 1)
const everyOtherDay = timeDay.filter((d) => timeDay.count(ANCHOR, d) % 2 === 0)

const COMPACT_STEPS: { seconds: number; interval: TimeInterval; format: DateFormatter }[] = [
  { seconds: 600, interval: timeMinute.every(10)!, format: fmt('h:mmaaa') },
  { seconds: 1800, interval: timeMinute.every(30)!, format: fmt('h:mmaaa') },
  { seconds: 3600, interval: timeHour.every(1)!, format: fmt('haaa') },
  { seconds: 7200, interval: timeHour.every(2)!, format: fmt('haaa') },
  { seconds: 14400, interval: timeHour.every(4)!, format: fmt('haaa') },
  { seconds: 21600, interval: timeHour.every(6)!, format: fmt('haaa') },
  { seconds: 43200, interval: timeHour.every(12)!, format: fmt('haaa') },
  { seconds: 86400, interval: timeDay.every(1)!, format: fmt('MMM d') },
  { seconds: 172800, interval: everyOtherDay, format: fmt('MMM d') },
  { seconds: 604800, interval: timeWeek.every(1)!, format: fmt('MMM d') },
  { seconds: 1209600, interval: timeWeek.every(2)!, format: fmt('MMM d') },
  { seconds: 2592000, interval: timeMonth.every(1)!, format: fmt('MMM d') },
]

function pickInterval(domain: [Date, Date], compact: boolean): { interval: CountableTimeInterval | TimeInterval; format: DateFormatter; labels: 'time' | 'day' | 'month' } {
  const minutes = timeMinute.count(domain[0], domain[1])
  const timeFmt = compact ? fmt('h:mmaaa') : fmt('h:mm a')
  const hourFmt = compact ? fmt('haaa') : fmt('h:mm a')
  if (minutes <= 60) return { interval: timeMinute.every(10)!, format: timeFmt, labels: 'time' }
  if (minutes <= 360) return { interval: timeHour.every(1)!, format: hourFmt, labels: 'time' }
  if (minutes <= 720) return { interval: timeHour.every(2)!, format: hourFmt, labels: 'time' }
  if (minutes <= 1440) return { interval: timeHour.every(4)!, format: hourFmt, labels: 'time' }
  if (minutes <= 4320) return { interval: timeHour.every(12)!, format: hourFmt, labels: 'time' }
  if (minutes <= 10080) return { interval: timeDay.every(1)!, format: fmt('MMM d'), labels: 'day' }
  if (minutes <= 20160) return { interval: timeDay.every(3)!, format: fmt('MMM d'), labels: 'day' }
  if (minutes <= 43800) return { interval: timeWeek.every(1)!, format: fmt('MMM d'), labels: 'day' }
  if (minutes <= 87600) return { interval: timeWeek.every(2)!, format: fmt('MMM d'), labels: 'day' }
  return { interval: timeMonth.every(1)!, format: fmt('MMM'), labels: 'month' }
}

/** Drop a first or last tick whose spacing is irregular (partial month/week). */
function trimIrregular(ticks: Date[]): Date[] {
  if (ticks.length <= 3) return ticks
  const first = timeMinute.count(ticks[0], ticks[1])
  const second = timeMinute.count(ticks[1], ticks[2])
  const last = timeMinute.count(ticks[ticks.length - 2], ticks[ticks.length - 1])
  if (first !== second && second === last) return ticks.slice(1)
  if (first === second && second !== last) return ticks.slice(0, -1)
  return ticks
}

export function timeTicks(x: ScaleTime<number, number>, compact = false): { ticks: Date[]; format: DateFormatter } {
  const domain = x.domain() as [Date, Date]
  const { interval, format, labels } = pickInterval(domain, compact)
  const base = x.ticks(interval as TimeInterval)
  if (compact && labels !== 'month') {
    const [r0 = 0, r1 = 0] = x.range()
    const px = Math.abs(r1 - r0)
    const secs = timeSecond.count(domain[0], domain[1])
    const step = px > 0 && secs > 0 ? COMPACT_STEPS.find((s) => s.seconds * (px / secs) >= 48) : undefined
    const t = step ? x.ticks(step.interval) : []
    return step && t.length ? { ticks: t, format: step.format } : { ticks: base.slice(-1), format }
  }
  return { ticks: trimIrregular(base), format }
}
