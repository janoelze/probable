// Design tokens and the stylesheet shared by every chart.
//
// Colors are `lab()` tokens exposed as `--pb-*` custom properties on
// `.pb-root`, so any of them can be overridden from CSS. `--pb-chart-bg` is the
// hook for charts that sit on a non-default background.

export type ThemeName = 'light' | 'dark'
export type ThemeOption = ThemeName | 'auto'

export const TOKENS: Record<ThemeName, Record<string, string>> = {
  light: {
    surface: 'lab(100% 0 0)',
    elevated: 'lab(100% 0 0)',
    border: 'lab(91.9748% -.136733 -1.92862)',
    'content-primary': 'lab(15.4544% -.764295 -4.69404)',
    'content-secondary': 'lab(47.7217% -1.37293 -5.88264)',
    'content-tertiary': 'lab(60.2895% -1.27381 -5.32016)',
    'gray-100': 'lab(96.5213% -.0690222 -.946689)',
    'gray-200': 'lab(91.9748% -.136733 -1.92862)',
    'gray-300': 'lab(85.872% -.495881 -2.97412)',
    'gray-400': 'lab(78.7165% -.528604 -3.76731)',
    'gray-800': 'lab(31.342% -.744402 -5.04124)',
    'brand-500': 'lab(44.7153% 32.3672 -86.8665)',
    up: 'lab(56.1642% -52.1702 40.2684)',
    down: 'lab(57.6529% 71.7613 52.8883)',
    'gauge-track': 'lab(91.9748% -.136733 -1.92862)',
    'live-text': '#77808d',
    'live-target-line': '#aeb4bc80',
    'live-target-pill': '#939aa5',
    'live-guide': '#aeb4bc80',
    'pill-text': '#1d1f24',
  },
  dark: {
    surface: 'lab(3.97501% -.0636876 -3.07571)',
    elevated: 'lab(11.7167% .285715 -5.93065)',
    border: 'lab(19.7332% .085786 -5.00613)',
    'content-primary': 'lab(100% 0 0)',
    'content-secondary': 'lab(75.6517% -.314564 -5.00366)',
    'content-tertiary': 'lab(64.872% -.31662 -5.22232)',
    'gray-100': 'lab(11.7167% .285715 -5.93065)',
    'gray-200': 'lab(19.7332% .085786 -5.00613)',
    'gray-300': 'lab(30.3117% .128046 -4.24758)',
    'gray-400': 'lab(42.477% -.118911 -3.54166)',
    'gray-800': 'lab(84.9739% -.17041 -2.45579)',
    'brand-500': 'lab(46.349% 29.2063 -84.1946)',
    up: 'lab(56.1642% -52.1702 40.2684)',
    down: 'lab(57.6529% 71.7613 52.8883)',
    'gauge-track': 'lab(30.3117% .128046 -4.24758)',
    'live-text': '#7b8996',
    'live-target-line': '#97a5b466',
    'live-target-pill': '#586879',
    'live-guide': '#97a5b466',
    'pill-text': 'lab(100% 0 0)',
  },
}

/** Series palette, in assignment order. */
export const PALETTE: Record<string, { light: string; dark: string; index: number }> = {
  'light-blue': { light: '#87BFFF', dark: '#87BFFF', index: 1 },
  'dark-blue': { light: '#4378FF', dark: '#2797FF', index: 2 },
  'yellow': { light: '#FDC503', dark: '#FDC503', index: 3 },
  orange: { light: '#FF7F0E', dark: '#FF7F0E', index: 4 },
  blue: { light: '#1452f0', dark: '#0093fd', index: 5 },
  red: { light: '#FF5952', dark: '#FF5952', index: 6 },
  green: { light: '#27AE60', dark: '#27AE60', index: 7 },
}

export const PALETTE_ORDER = Object.keys(PALETTE).sort((a, b) => PALETTE[a].index - PALETTE[b].index)

const HEX = /^#(?:[0-9a-f]{3}){1,2}$/i

/** Resolve a palette key, `#hex`, `"#light,#dark"` pair or any CSS color for a theme. */
export function resolveColor(color: string, theme: ThemeName): string {
  const p = PALETTE[color]
  if (p) return p[theme]
  if (color.includes(',')) {
    const [l, d] = color.split(',').map((s) => s.trim())
    if (HEX.test(l) && HEX.test(d)) return theme === 'dark' ? d : l
  }
  return color
}

const FONT_FEATURES = `"calt","cv01","cv02","cv03","cv04","cv09" 0,"cv11","cv15","liga"`

function vars(theme: ThemeName) {
  return Object.entries(TOKENS[theme])
    .map(([k, v]) => `--pb-${k}:${v};`)
    .join('')
}

const CSS = `
.pb-root{${vars('light')}--pb-chart-bg:var(--pb-surface);--pb-font:InterVariable,Inter,"Inter Variable",inter,ui-sans-serif,system-ui,sans-serif;
  font-family:var(--pb-font);font-feature-settings:${FONT_FEATURES};color:var(--pb-content-primary);
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;position:relative;width:100%;box-sizing:border-box}
.pb-root *{box-sizing:border-box}
.pb-root[data-pb-theme=dark]{${vars('dark')}}
.pb-root svg{display:block}
.pb-chart{display:flex;flex-direction:column;gap:var(--pb-gap,15px)}
.pb-chart:not(.pb-has-header)>.pb-plot{margin-top:var(--pb-gap,15px)}
.pb-plot{position:relative;display:flex;flex:none;width:100%;overflow:visible}
.pb-plot>svg{overflow:visible;flex:none}
.pb-attribution{pointer-events:none;position:absolute;z-index:1;display:flex;align-items:center;border-radius:4px;
  background:color-mix(in srgb,var(--pb-gray-200) 60%,transparent);padding:2px 6px;-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}
.pb-attribution span{user-select:none;font-size:11px;font-weight:600;line-height:12px;color:var(--pb-content-secondary)}
.pb-date-tip{position:absolute;pointer-events:none;white-space:nowrap;font-size:12px;line-height:16px;font-weight:500;color:var(--pb-content-secondary);opacity:0;transition:opacity .125s ease-out .02s}
.pb-date-tip.pb-on{opacity:1}
.pb-date-tip.pb-off{transition:opacity .15s ease-out}
.pb-pills{position:absolute;left:0;top:0;width:0;height:0;z-index:5}
.pb-pill{position:absolute;top:0;display:flex;pointer-events:none;z-index:2;animation:pb-fade .125s ease-out .02s both}
.pb-pill>div{display:flex;align-items:center;height:20px;border-radius:4px;gap:4px;padding-right:6px;
  background:var(--pb-chart-bg,var(--pb-surface,#fff));border:1px solid var(--pb-border,#e5e5e5);white-space:nowrap}
.pb-pill i{display:block;flex-shrink:0;width:4px;height:12px;margin-left:4px;border-radius:2px}
.pb-pill p{margin:0;padding:0;font-size:12px;line-height:20px;font-weight:600;text-transform:capitalize;color:var(--pb-pill-text);overflow:hidden;text-overflow:ellipsis}
.pb-pill .pb-diff{display:flex;align-items:center;gap:2px;font-size:12px;line-height:20px;font-weight:600}
.pb-side{position:absolute;left:0;width:100%;pointer-events:none;overflow:visible}
.pb-side-item{position:absolute;left:0;top:0;pointer-events:none;z-index:10;transition:transform .2s ease-out,opacity .15s;will-change:transform}
.pb-side-item>div{display:flex;flex-direction:column;align-items:flex-start;gap:3.3px}
.pb-side-item span{-webkit-text-stroke:3px var(--pb-chart-bg,var(--pb-surface));paint-order:stroke fill;white-space:nowrap}
.pb-side-name{font-size:13px;line-height:14px;font-weight:500}
.pb-side-value{font-size:26px;line-height:1;font-weight:600}
.pb-legend-row{display:flex;align-items:center;width:100%;gap:12px}
.pb-legend{display:flex;flex-wrap:wrap;align-items:center;align-self:center;column-gap:12px;row-gap:4px;width:100%}
.pb-legend-item{display:flex;align-items:center;gap:6px;white-space:nowrap;line-height:16px}
.pb-legend-item i{display:block;width:8px;height:8px;border-radius:9999px}
.pb-legend-item p{margin:0;color:var(--pb-content-secondary);font-size:13px;line-height:16px;font-weight:490;letter-spacing:-.1px}
.pb-legend-item b{color:var(--pb-gray-800);font-weight:600;margin-left:2px}
.pb-watermark{margin-left:auto;align-self:flex-end;height:24px;color:var(--pb-gray-300)}
.pb-summary{display:flex;align-items:center;gap:8px;min-height:32px}
.pb-summary-value{font-size:24px;line-height:32px;font-weight:600;font-variant-numeric:normal}
.pb-change{display:flex;align-items:center;gap:2px;margin-top:4px;font-size:12px;line-height:12px;font-weight:400;font-variant-numeric:tabular-nums}
.pb-change.pb-up{color:var(--pb-up)}
.pb-change.pb-down{color:var(--pb-down)}
.pb-wrapped{gap:0!important}
.pb-wrapped .pb-side-name{white-space:normal;overflow-wrap:break-word;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pb-live{position:relative}
.pb-live-tip{position:absolute;left:0;top:0;display:flex;flex-direction:column;align-items:center;gap:3px;padding:5px 0;pointer-events:none;z-index:100;opacity:0;-webkit-backdrop-filter:blur(.5px);backdrop-filter:blur(.5px);white-space:nowrap}
.pb-live-tip-v{font-size:12px;line-height:15px;font-weight:500}
.pb-live-tip-d{display:flex;gap:3px;font-size:11px;line-height:14px;color:var(--pb-content-secondary)}
.pb-gauge{display:inline-flex;flex-direction:column;align-items:center;gap:4px;width:auto}
.pb-gauge-label{font-size:13px;line-height:16px;font-weight:600;color:var(--pb-content-primary);white-space:nowrap;font-variant-numeric:tabular-nums}
.pb-annotation circle{transition:r .15s ease-out}
.pb-annotation.pb-active circle:nth-child(2){stroke-width:2}
.pb-anno-card{position:absolute;z-index:6;max-width:240px;padding:10px 12px;border-radius:10px;background:var(--pb-chart-bg,var(--pb-surface));border:1px solid var(--pb-border);
  box-shadow:0 4px 16px rgba(0,0,0,.08);pointer-events:none;opacity:0;transform:translateY(4px);transition:opacity .15s ease-out,transform .15s ease-out;display:grid;gap:8px}
.pb-anno-card.pb-on{opacity:1;transform:none}
.pb-anno-item{display:grid;gap:2px}
.pb-anno-date{font-size:11px;line-height:14px;color:var(--pb-content-tertiary)}
.pb-anno-item b{font-size:13px;line-height:17px;font-weight:600;color:var(--pb-content-primary)}
.pb-anno-item p{margin:0;font-size:12px;line-height:16px;color:var(--pb-content-secondary)}
.pb-bars{display:flex;flex-direction:column;gap:14px}
.pb-bar-row{display:grid;gap:6px}
.pb-bar-head{display:flex;align-items:baseline;gap:8px}
.pb-bar-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;line-height:20px;font-weight:500;color:var(--pb-content-primary)}
.pb-bar-change{display:flex;align-items:center;gap:2px;font-size:12px;line-height:16px;font-variant-numeric:tabular-nums}
.pb-bar-change.pb-up{color:var(--pb-up)}
.pb-bar-change.pb-down{color:var(--pb-down)}
.pb-bar-value{min-width:48px;text-align:right;font-size:16px;line-height:20px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--pb-content-primary)}
.pb-bar-track{border-radius:999px;background:var(--pb-gray-100);overflow:hidden}
.pb-bar-track i{display:block;height:100%;width:0;border-radius:999px}
.pb-windows{display:flex;gap:0;justify-content:flex-end}
.pb-windows button{all:unset;cursor:pointer;height:36px;display:inline-flex;align-items:center;padding:4px 6px;border-radius:9.2px;
  font-size:14px;line-height:20px;font-weight:600;letter-spacing:-.09px;text-transform:uppercase;color:var(--pb-content-secondary)}
.pb-windows button:hover,.pb-windows button[aria-pressed=true]{color:var(--pb-content-primary)}
.pb-error{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--pb-content-secondary)}
.pb-enter{animation:pb-fade .3s ease-out both}
@keyframes pb-fade{from{opacity:0}to{opacity:1}}
`

let injected = false

/** Injects the shared stylesheet once. Called automatically by the charts. */
export function injectStyles(doc: Document = document) {
  if (injected || doc.getElementById('pb-styles')) return
  injected = true
  const style = doc.createElement('style')
  style.id = 'pb-styles'
  style.textContent = CSS
  doc.head.appendChild(style)
}

/** Tracks the effective theme for `'auto'` via prefers-color-scheme. */
export function watchTheme(option: ThemeOption, onChange: (t: ThemeName) => void): { theme: ThemeName; stop(): void } {
  if (option !== 'auto' || typeof matchMedia === 'undefined') return { theme: option === 'auto' ? 'light' : option, stop() {} }
  const mq = matchMedia('(prefers-color-scheme: dark)')
  const handler = () => onChange(mq.matches ? 'dark' : 'light')
  mq.addEventListener('change', handler)
  return { theme: mq.matches ? 'dark' : 'light', stop: () => mq.removeEventListener('change', handler) }
}

/**
 * Mixes two hex colors in HSL (hue along the shorter arc) at `percent` 0–100.
 * Used by the gradient line, where dots and labels take the color of their value.
 */
export function mixHsl(start: string, end: string, percent: number): string {
  const toHsl = (hex: string) => {
    const r = parseInt(hex.substr(1, 2), 16) / 255
    const g = parseInt(hex.substr(3, 2), 16) / 255
    const b = parseInt(hex.substr(5, 2), 16) / 255
    const mx = Math.max(r, g, b)
    const mn = Math.min(r, g, b)
    const l = (mx + mn) / 2
    let h = 0
    let s = 0
    if (mx !== mn) {
      const d = mx - mn
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)
      if (mx === r) h = (g - b) / d + (g < b ? 6 : 0)
      else if (mx === g) h = (b - r) / d + 2
      else h = (r - g) / d + 4
      h /= 6
    }
    return { h: 360 * h, s, l }
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  const hex = (v: number) => Math.round(255 * v).toString(16).padStart(2, '0')
  const a = toHsl(start)
  const b = toHsl(end)
  const t = Math.max(0, Math.min(percent / 100, 1))
  let dh = b.h - a.h
  if (dh > 180) dh -= 360
  if (dh < -180) dh += 360
  const h = ((a.h + t * dh + 360) % 360) / 360
  const s = a.s + t * (b.s - a.s)
  const l = a.l + t * (b.l - a.l)
  if (s === 0) return `#${hex(l)}${hex(l)}${hex(l)}`
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return `#${hex(hue2rgb(p, q, h + 1 / 3))}${hex(hue2rgb(p, q, h))}${hex(hue2rgb(p, q, h - 1 / 3))}`
}
