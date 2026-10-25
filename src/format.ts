// Formatting helpers. Dates use a tiny subset of date-fns tokens
// (`format(date, 'MMM d, h:mm a')` etc.) without the dependency.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Supports the tokens yyyy MMM d h mm ss a aaa. */
export function formatDate(date: Date, pattern: string): string {
  const h24 = date.getHours()
  const h12 = h24 % 12 || 12
  const pad = (n: number) => String(n).padStart(2, '0')
  return pattern.replace(/yyyy|MMM|aaa|mm|ss|a|d|h/g, (tok) => {
    switch (tok) {
      case 'yyyy': return String(date.getFullYear())
      case 'MMM': return MONTHS[date.getMonth()]
      case 'd': return String(date.getDate())
      case 'h': return String(h12)
      case 'mm': return pad(date.getMinutes())
      case 'ss': return pad(date.getSeconds())
      case 'a': return h24 < 12 ? 'AM' : 'PM'
      case 'aaa': return h24 < 12 ? 'am' : 'pm'
      default: return tok
    }
  })
}

/** 0.837 → "84%"; decimals via toFixed. */
export function formatPercent(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '0%'
  const v = 100 * value
  const s = Math.abs(v).toFixed(decimals)
  return v < 0 ? `-${s}%` : `${s}%`
}

/** Legend value: "<1%" below one percent, otherwise `decimals` places. */
export function formatLegendValue(value: number, decimals = 0): string {
  const pct = 100 * value
  const v = decimals ? parseFloat(pct.toFixed(decimals)) : parseInt(pct.toFixed(), 10)
  return v < 1 ? '<1%' : `${v.toFixed(decimals)}%`
}

/** lodash `truncate(str, { length, separator: ' ' })` with the default "..." omission. */
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  const end = length - 3
  if (end < 1) return '...'
  let s = str.slice(0, end)
  if (str.indexOf(' ', end) !== end) {
    const i = s.lastIndexOf(' ')
    if (i > -1) s = s.slice(0, i)
  }
  return s + '...'
}

let ctx: CanvasRenderingContext2D | null = null

/** Canvas text width, rounded up. */
export function measureText(text: string, font: { fontSize: number; fontFamily: string; fontWeight?: number }): number {
  if (typeof document === 'undefined') return Math.ceil(text.length * font.fontSize * 0.55)
  ctx ??= document.createElement('canvas').getContext('2d')
  if (!ctx) return Math.ceil(text.length * font.fontSize * 0.55)
  ctx.font = [font.fontWeight, `${font.fontSize}px`, font.fontFamily].filter(Boolean).join(' ')
  return Math.ceil(ctx.measureText(text).width)
}

/** Plain number, en-US grouping, up to `decimals` places, no trailing zeros ("6,594.2"). */
export function formatNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '0'
  const d = Math.min(20, Math.max(0, Math.floor(decimals)))
  return value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: Number.isInteger(value) ? 0 : d })
}

/** Compact suffix: 1.25e12 → { value: "1.250", unit: "T" }, 6400 → "6.4K". */
export function compactParts(value: number): { value: string; unit: string } {
  const a = Math.abs(value)
  if (a >= 1e12) return { value: (value / 1e12).toFixed(3), unit: 'T' }
  if (a >= 1e9) return { value: (value / 1e9).toFixed(2), unit: 'B' }
  if (a >= 1e6) return { value: (value / 1e6).toFixed(2), unit: 'M' }
  if (a >= 1e3) return { value: (value / 1e3).toFixed(1), unit: 'K' }
  return { value: value.toFixed(0), unit: '' }
}

/** Currency: "$1.25M" from a thousand up, "$812.50" below. */
export function formatCurrency(value: number, decimals = 2): string {
  if (Math.abs(value) >= 1000) {
    const c = compactParts(value)
    return `$${c.value}${c.unit}`
  }
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
}

/** Default value formatter for a chart's `valueFormat`. */
export function formatValue(value: number, decimals: number, format: 'percent' | 'number' | 'currency' = 'percent'): string {
  if (format === 'number') return formatNumber(value, decimals)
  if (format === 'currency') return formatCurrency(value, decimals)
  return formatPercent(value, decimals)
}

/** Header text for the summary: the big value and the change since the first point. */
export function summaryParts(value: number, change: number, format: 'percent' | 'number' | 'currency', unit = ''): { value: string; change: string } {
  const suffix = unit ? ` ${unit}` : ''
  if (format === 'currency') {
    return { value: formatCurrency(value) + suffix, change: Math.abs(change) >= 1000 ? formatCurrency(Math.abs(change)) : `$${Math.round(Math.abs(change)).toLocaleString('en-US')}` }
  }
  if (format === 'number') {
    return { value: value.toLocaleString('en-US', { maximumFractionDigits: 3 }) + suffix, change: Math.round(Math.abs(change)).toLocaleString('en-US') }
  }
  return { value: formatPercent(value, 1) + suffix, change: formatPercent(Math.abs(change), 0) }
}
