import { ProbabilityChart, formatPercent, type ProbabilityChartOptions, type Series } from '../src/index'
import type { DemoContext } from './main'
import { forecast, game, mayorRace, rateDecision, yesNo } from './data'

const DATASETS: { key: string; label: string; make: () => Series[]; options?: ProbabilityChartOptions }[] = [
  { key: 'race', label: 'Two candidates', make: mayorRace },
  { key: 'rates', label: 'Four outcomes', make: rateDecision },
  { key: 'yesno', label: 'Yes / No', make: yesNo, options: { height: 272 } },
  { key: 'game', label: 'Game', make: game, options: { labelMaxWidth: 112 } },
  { key: 'forecast', label: 'Number', make: forecast, options: { valueFormat: 'number', unit: 'tickets' } },
]

type Ctl =
  | { key: string; label: string; type: 'bool' }
  | { key: string; label: string; type: 'select'; options: string[] }
  | { key: string; label: string; type: 'range'; min: number; max: number; step: number }

const GROUPS: { title: string; items: Ctl[] }[] = [
  {
    title: 'Layout',
    items: [
      { key: 'width', label: 'Width', type: 'range', min: 280, max: 922, step: 1 },
      { key: 'height', label: 'Height', type: 'range', min: 120, max: 480, step: 1 },
      { key: 'labels', label: 'Labels', type: 'select', options: ['auto', 'end', 'legend'] },
      { key: 'labelMaxWidth', label: 'Wrap at', type: 'range', min: 0, max: 200, step: 4 },
      { key: 'yAxisOrientation', label: 'Y axis', type: 'select', options: ['right', 'left'] },
    ],
  },
  {
    title: 'Elements',
    items: [
      { key: 'xAxis', label: 'X axis', type: 'bool' },
      { key: 'yAxis', label: 'Y axis', type: 'bool' },
      { key: 'gridHorizontal', label: 'Horizontal grid', type: 'bool' },
      { key: 'gridVertical', label: 'Vertical grid', type: 'bool' },
      { key: 'attribution', label: 'Attribution', type: 'bool' },
      { key: 'timeWindows', label: 'Time windows', type: 'bool' },
      { key: 'autoscale', label: 'Autoscale', type: 'bool' },
      { key: 'compactTimeAxis', label: 'Compact time axis', type: 'bool' },
    ],
  },
  {
    title: 'Style',
    items: [
      { key: 'strokeWidth', label: 'Stroke', type: 'range', min: 0.5, max: 4, step: 0.25 },
      { key: 'area', label: 'Area fill', type: 'range', min: 0, max: 0.4, step: 0.01 },
      { key: 'gradient', label: 'Gradient line', type: 'bool' },
    ],
  },
  {
    title: 'Motion & interaction',
    items: [
      { key: 'animate', label: 'Animate', type: 'bool' },
      { key: 'shimmer', label: 'Shimmer', type: 'bool' },
      { key: 'pulse', label: 'Pulse', type: 'bool' },
      { key: 'interactive', label: 'Hover', type: 'bool' },
      { key: 'dragRange', label: 'Drag range', type: 'bool' },
    ],
  },
]

const BASE: Record<string, unknown> = {
  width: 922, height: 240, labels: 'auto', labelMaxWidth: 0, yAxisOrientation: 'right', xAxis: true, yAxis: true,
  gridHorizontal: true, gridVertical: false, attribution: false, timeWindows: false, autoscale: true,
  compactTimeAxis: false, strokeWidth: 1.75, area: 0, gradient: false, animate: true, shimmer: true,
  pulse: true, interactive: true, dragRange: true, valueFormat: 'percent', unit: '',
}

export function playground(el: HTMLElement, ctx: DemoContext) {
  const state: Record<string, unknown> = { ...BASE }
  el.insertAdjacentHTML(
    'beforeend',
    `<section class="demo"><div class="demo-head"><span class="demo-title">Dataset</span><span class="demo-tabs pg-sets"></span></div>
      <div class="playground"><div class="stage"><div class="pg-chart"></div></div><div class="controls"></div></div>
      <div class="demo-note pg-hover">Hover the chart</div></section>`,
  )
  const chartEl = el.querySelector<HTMLElement>('.pg-chart')!
  chartEl.style.width = `${state.width}px`
  chartEl.style.maxWidth = '100%'

  const opts = (): ProbabilityChartOptions => ({
    ...(state as ProbabilityChartOptions),
    area: (state.area as number) || false,
    attribution: state.attribution ? 'Source: placeholder data' : false,
    startColor: state.gradient ? '#FF5952' : undefined,
    endColor: state.gradient ? '#27AE60' : undefined,
  })
  const chart = ctx.track(
    new ProbabilityChart(chartEl, {
      ...opts(),
      theme: ctx.theme,
      onHover: (pts, date) => {
        el.querySelector('.pg-hover')!.textContent = pts && date ? `${date.toLocaleString()} · ${pts.map((p) => `${p.label || 'Value'} ${state.valueFormat === 'percent' ? formatPercent(p.point.value, 1) : p.point.value.toLocaleString('en-US')}`).join(' · ')}` : 'Hover the chart'
      },
    }),
  )

  const controls = el.querySelector<HTMLElement>('.controls')!
  const inputs = new Map<string, HTMLInputElement | HTMLSelectElement>()
  for (const g of GROUPS) {
    const fs = document.createElement('fieldset')
    fs.innerHTML = `<legend>${g.title}</legend>`
    for (const c of g.items) {
      const label = document.createElement('label')
      label.append(c.label)
      if (c.type === 'bool') {
        const input = Object.assign(document.createElement('input'), { type: 'checkbox', checked: !!state[c.key] })
        input.onchange = () => set(c.key, input.checked)
        inputs.set(c.key, input)
        label.append(input)
      } else if (c.type === 'select') {
        const sel = document.createElement('select')
        sel.innerHTML = c.options.map((o) => `<option ${o === state[c.key] ? 'selected' : ''}>${o}</option>`).join('')
        sel.onchange = () => set(c.key, sel.value)
        inputs.set(c.key, sel)
        label.append(sel)
      } else {
        const wrap = document.createElement('span')
        wrap.style.cssText = 'display:flex;align-items:center;gap:6px'
        const input = Object.assign(document.createElement('input'), { type: 'range', min: c.min, max: c.max, step: c.step, value: String(state[c.key]) })
        const val = Object.assign(document.createElement('span'), { className: 'val', textContent: String(state[c.key]) })
        input.oninput = () => {
          val.textContent = input.value
          set(c.key, parseFloat(input.value))
        }
        inputs.set(c.key, input)
        wrap.append(input, val)
        label.append(wrap)
      }
      fs.append(label)
    }
    controls.append(fs)
  }

  function set(key: string, value: unknown) {
    state[key] = value
    if (key === 'width') chartEl.style.width = `${value}px`
    else chart.setOptions(opts())
  }

  function sync() {
    for (const [k, input] of inputs) {
      if (input instanceof HTMLInputElement && input.type === 'checkbox') input.checked = !!state[k]
      else {
        input.value = String(state[k])
        const val = input.nextElementSibling
        if (val) val.textContent = String(state[k])
      }
    }
  }

  function pick(key: string) {
    const d = DATASETS.find((x) => x.key === key)!
    el.querySelectorAll<HTMLButtonElement>('.pg-sets button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.key === key)))
    Object.assign(state, { height: 240, labelMaxWidth: 0, valueFormat: 'percent', unit: '' }, d.options ?? {})
    sync()
    chart.setOptions(opts())
    chart.setSeries(d.make())
  }

  const sets = el.querySelector<HTMLElement>('.pg-sets')!
  for (const d of DATASETS) {
    const b = Object.assign(document.createElement('button'), { textContent: d.label })
    b.dataset.key = d.key
    b.onclick = () => pick(d.key)
    sets.append(b)
  }
  pick(DATASETS[0].key)
}
