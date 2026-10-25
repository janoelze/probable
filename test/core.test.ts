import { describe, expect, it } from 'vitest'
import { scaleLinear } from 'd3-scale'
import { niceTicks } from '../src/ticks'
import { compactParts, formatCurrency, formatDate, formatLegendValue, formatNumber, formatPercent, summaryParts, truncate } from '../src/format'
import { alignEnds, appendLatest, assignColors, backfill } from '../src/data'
import { resolveColor } from '../src/theme'

describe('niceTicks', () => {
  const ticksFor = (d: [number, number]) => niceTicks(scaleLinear().domain(d).nice(5).domain() as [number, number])

  it('gives 0–100% in quarters for wide ranges (the common event chart)', () => {
    expect(ticksFor([0.06, 0.9])).toEqual({ ticks: [0, 0.25, 0.5, 0.75, 1], boundMin: 0, boundMax: 1 })
  })
  it('zooms in for narrow ranges', () => {
    expect(ticksFor([0.62, 0.71]).ticks).toEqual([0.62, 0.64, 0.66, 0.68, 0.7, 0.72])
  })
  it('handles a degenerate domain', () => {
    expect(niceTicks([0.5, 0.5]).ticks).toEqual([0.5])
  })
})

describe('format', () => {
  it('formats percents with toFixed semantics', () => {
    expect(formatPercent(0.837, 1)).toBe('83.7%')
    expect(formatPercent(0.17, 0)).toBe('17%')
    expect(formatPercent(0.17, 1)).toBe('17.0%')
  })
  it('formats legend values with a <1% floor', () => {
    expect(formatLegendValue(0.966, 1)).toBe('96.6%')
    expect(formatLegendValue(0.004, 1)).toBe('<1%')
    expect(formatLegendValue(0.014, 0)).toBe('1%')
  })
  it('formats numbers and currency', () => {
    expect(formatNumber(6594.2, 0)).toBe('6,594')
    expect(formatNumber(6594, 2)).toBe('6,594')
    expect(formatNumber(12.345, 2)).toBe('12.35')
    expect(formatCurrency(812.5)).toBe('$812.50')
    expect(formatCurrency(1_250_000)).toBe('$1.25M')
    expect(compactParts(2.25e12)).toEqual({ value: '2.250', unit: 'T' })
  })
  it('builds summary header text', () => {
    expect(summaryParts(6594.203, 172.6, 'number', 'cases')).toEqual({ value: '6,594.203 cases', change: '173' })
    expect(summaryParts(0.42, -0.031, 'percent')).toEqual({ value: '42.0%', change: '3%' })
  })
  it('formats dates with date-fns tokens', () => {
    const d = new Date(2026, 4, 15, 14, 5)
    expect(formatDate(d, 'MMM d, h:mm a')).toBe('May 15, 2:05 PM')
    expect(formatDate(d, 'MMM d, yyyy')).toBe('May 15, 2026')
    expect(formatDate(d, 'haaa')).toBe('2pm')
  })
  it('truncates at word boundaries like lodash', () => {
    expect(truncate('Luiz Inácio Lula da Silva', 24)).toBe('Luiz Inácio Lula da...')
    expect(truncate('Short', 24)).toBe('Short')
  })
})

describe('data pipeline', () => {
  it('backfills a late series with its first value', () => {
    const [a, b] = backfill([
      [{ time: 1, value: 0.5 }, { time: 2, value: 0.6 }, { time: 3, value: 0.7 }],
      [{ time: 3, value: 0.2 }],
    ])
    expect(a.backfilled).toEqual([])
    expect(b.backfilled).toEqual([{ time: 1, value: 0.2 }, { time: 2, value: 0.2 }])
    expect(b.data.map((p) => p.time)).toEqual([1, 2, 3])
  })
  it('appends a latest value only when newer', () => {
    const d = [{ time: 10, value: 0.4 }]
    expect(appendLatest(d, 0.45, 20)).toEqual([...d, { time: 20, value: 0.45 }])
    expect(appendLatest(d, 0.45, 5)).toBe(d)
    expect(appendLatest(d, undefined, 20)).toBe(d)
  })
  it('aligns series ends', () => {
    const out = alignEnds([
      { data: [{ time: 1, value: 0.1 }] },
      { data: [{ time: 1, value: 0.2 }, { time: 5, value: 0.3 }] },
    ])
    expect(out[0].data.at(-1)).toEqual({ time: 5, value: 0.1 })
  })
  it('assigns palette colors in order, honouring explicit keys', () => {
    const out = assignColors([{ color: undefined }, { color: 'light-blue' }, {}])
    expect(out.map((o) => o.color)).toEqual(['dark-blue', 'light-blue', 'yellow'])
  })
})

describe('theme', () => {
  it('resolves palette keys per theme', () => {
    expect(resolveColor('dark-blue', 'light')).toBe('#4378FF')
    expect(resolveColor('dark-blue', 'dark')).toBe('#2797FF')
    expect(resolveColor('#abc,#def', 'dark')).toBe('#def')
    expect(resolveColor('tomato', 'light')).toBe('tomato')
  })
})
