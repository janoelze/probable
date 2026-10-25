import type { ApiSpec } from './api'
import type { DemoContext } from './main'
import { highlight } from './util'
import { CHART_DEFAULTS, SPARKLINE_DEFAULTS, GAUGE_DEFAULTS, LIVE_CHART_DEFAULTS, PALETTE, PALETTE_ORDER, TOKENS } from '../src/index'
import { playground } from './playground'

export interface Demo {
  title: string
  file: string
  note?: string
  width?: number
}

export interface Section {
  html?: string
  demo?: Demo
  api?: ApiSpec
  custom?: (el: HTMLElement, ctx: DemoContext) => unknown
}

export interface Page {
  id: string
  group: string
  title: string
  tag?: string
  intro?: string
  sections?: Section[]
}

const code = (src: string) => `<pre class="block">${highlight(src.trim())}</pre>`
const p = (s: string) => `<p>${s}</p>`
const asRecord = (o: object) => o as Record<string, unknown>
// The deploy copies the library build next to the site.
const LIB_URL = new URL(`${import.meta.env.BASE_URL}lib/probable.js`, location.origin).href

export const GROUPS = ['Getting started', 'ProbabilityChart', 'LiveChart', 'Sparkline', 'Gauge', 'Reference']

export const PAGES: Page[] = [
  {
    id: 'overview',
    group: 'Getting started',
    title: 'probable',
    intro: `<p class="lead">Polished, animated charts for probabilities and forecasts. Framework-agnostic, built on d3, about 40 kB gzipped. Every visual constant is an option and every color is a CSS variable.</p>`,
    sections: [
      { demo: { title: 'ProbabilityChart · end labels', file: 'end-labels' } },
      {
        html: `<h2>Charts</h2><div class="cards">
          <a class="card-link" href="#/end-labels"><b>ProbabilityChart</b><span>Lines over time with end labels or a legend, hover pills, drag-to-compare, time windows and smooth updates.</span></a>
          <a class="card-link" href="#/live"><b>LiveChart</b><span>A streaming price line that scrolls in real time, with a target line and crosshair.</span></a>
          <a class="card-link" href="#/sparkline"><b>Sparkline</b><span>Compact lines for cards and table rows: draw-in, track and pulsing end dot.</span></a>
          <a class="card-link" href="#/gauge"><b>Gauge</b><span>A 200° arc for a single probability.</span></a>
        </div>
        <h2>Install</h2>${p('Not on npm yet. Install from GitHub (it builds on install):')}${code(`npm install github:janoelze/probable`)}${p('Or use it straight from a browser module, no build step:')}${code(`import { ProbabilityChart } from '${LIB_URL}'`)}
        <h2>Quick start</h2>${code(`import { ProbabilityChart } from 'probable'

const chart = new ProbabilityChart(document.getElementById('chart'))
chart.setSeries([
  { id: 'yes', label: 'Yes', color: 'blue', data: [{ time: 1761955200, value: 0.42 }, /* … */] },
])`)}
        ${p('Times are unix seconds and values 0–1 (or any number with <code>valueFormat: \'number\'</code>). Load <a href="https://rsms.me/inter/" target="_blank">Inter</a> for the intended typography.')}
        ${p('All data on this site is placeholder data. Source: <a href="https://github.com/janoelze/probable" target="_blank" rel="noopener">github.com/janoelze/probable</a>.')}
        <h2>Credits</h2>
        ${p('The visual design is inspired by the charts on <a href="https://polymarket.com" target="_blank" rel="noopener">Polymarket</a>. This is an independent project, not affiliated with or endorsed by Polymarket.')}`,
      },
    ],
  },
  {
    id: 'end-labels',
    group: 'ProbabilityChart',
    title: 'End labels',
    intro: p('With two series, each line ends in its name over a large value, haloed in the background color so it stays readable where lines cross. Hover to move the labels with the cursor; drag across the plot to compare two points. The second series starts later: before its first point it is drawn dashed (see <code>backfill()</code>).'),
    sections: [{ demo: { title: 'Two series', file: 'end-labels' } }],
  },
  {
    id: 'legend',
    group: 'ProbabilityChart',
    title: 'Legend & pills',
    intro: p('Three or more series get a legend above the plot and value pills next to the cursor that push each other apart instead of overlapping. Series reordered between updates glide to their new legend position. The time-window selector is UI only: <code>onWindowChange</code> tells you which data to show.'),
    sections: [{ demo: { title: 'Four outcomes with time windows', file: 'legend' } }],
  },
  {
    id: 'single',
    group: 'ProbabilityChart',
    title: 'Single series',
    intro: p('One line, no legend, a 272px plot. With <code>autoscale</code> the y axis zooms in on the data; ticks prefer five even steps.'),
    sections: [{ demo: { title: 'Yes / No', file: 'single' } }],
  },
  {
    id: 'wrapped-labels',
    group: 'ProbabilityChart',
    title: 'Wrapped labels',
    intro: p('<code>labelMaxWidth</code> lets end labels wrap onto two lines in one shared column. Labels stack tightly and the hover date moves just above the top label. Good for team or candidate names.'),
    sections: [{ demo: { title: 'labelMaxWidth: 112, 200px plot', file: 'wrapped-labels', width: 684 } }],
  },
  {
    id: 'number',
    group: 'ProbabilityChart',
    title: 'Numbers & units',
    intro: p('Not everything is a probability. <code>valueFormat: \'number\'</code> (or <code>\'currency\'</code>) formats axis, pills and labels as numbers, and a summary header shows the current value with its change over the range. The header follows the cursor.'),
    sections: [{ demo: { title: "valueFormat: 'number', unit: 'tickets'", file: 'number' } }],
  },
  {
    id: 'gradient',
    group: 'ProbabilityChart',
    title: 'Gradient line',
    intro: p('With <code>startColor</code> and <code>endColor</code> the stroke runs from the start color (50% opacity) at the bottom to the color of the current value, mixed in HSL. The end dot, hover markers and pills take the color of their value.'),
    sections: [{ demo: { title: 'Red → green by value', file: 'gradient' } }],
  },
  {
    id: 'area',
    group: 'ProbabilityChart',
    title: 'Area fill',
    intro: p('<code>area: true</code> fills under each line at 5%, fading out; pass a number for a different opacity. The fill is clipped at the cursor together with the line.'),
    sections: [{ demo: { title: 'area: 0.12', file: 'area' } }],
  },
  {
    id: 'compact',
    group: 'ProbabilityChart',
    title: 'Compact card',
    intro: p('At card width, <code>compactTimeAxis</code> picks the first tick interval that is at least 48px wide and uses short labels.'),
    sections: [{ demo: { title: 'compactTimeAxis at 496px', file: 'compact', width: 496 } }],
  },
  {
    id: 'custom-data',
    group: 'ProbabilityChart',
    title: 'Data format',
    intro: p('A series is an id, a label, a color and points <code>{ time, value }</code> with unix-second times. <code>decimals</code> controls the label precision. Call <code>setSeries()</code> again with new data and changed lines morph into place.'),
    sections: [{ demo: { title: 'Minimal example', file: 'custom-data' } }, { html: '<h2>Series</h2>', api: { interface: 'Series' } }],
  },
  {
    id: 'theming',
    group: 'ProbabilityChart',
    title: 'Theming',
    intro: p('<code>theme</code> switches between light and dark tokens (or follows the OS with <code>\'auto\'</code>). Every color is a CSS variable on <code>.pb-root</code>.'),
    sections: [
      { demo: { title: 'Custom colors on a custom background', file: 'theming' } },
      { html: `<h2>Variables</h2>${p('Set these on the chart element or any ancestor. <code>--pb-chart-bg</code> matters when the chart is not on the page background: end labels, pills and the dashed backfill use it. Left swatch light, right dark.')}`, custom: (el) => tokens(el) },
    ],
  },
  {
    id: 'playground',
    group: 'ProbabilityChart',
    title: 'Playground',
    intro: p('Every option, live, on placeholder datasets.'),
    sections: [{ custom: (el, ctx) => playground(el, ctx) }],
  },
  {
    id: 'live',
    group: 'LiveChart',
    title: 'LiveChart',
    intro: p('A price line that scrolls in real time. <code>push(value)</code> adds a point that glides in over one second; the y axis rescales every frame with 20% padding; a dashed line marks the current value and the head pulses. <code>setTarget()</code> draws a reference price with a pill. Hover for a crosshair.'),
    sections: [
      { demo: { title: 'Simulated feed, one value per second', file: 'live' } },
      { demo: { title: 'Target outside the visible range', file: 'live-offscale' } },
      { html: '<h2>Options</h2>', api: { interface: 'LiveChartOptions', defaults: asRecord(LIVE_CHART_DEFAULTS) } },
      { html: '<h2>Methods</h2>', api: { class: 'LiveChart' } },
    ],
  },
  {
    id: 'sparkline',
    group: 'Sparkline',
    title: 'Sparkline',
    intro: p('Compact lines for cards and tables. Points are spaced evenly, a 15% track sits under the line, the line draws in over 600ms and the end dot pulses.'),
    sections: [
      { demo: { title: 'Cards', file: 'spark-cards' } },
      { demo: { title: 'Table row (hover it)', file: 'spark-row' } },
      { demo: { title: 'Scrubbing widget', file: 'spark-widget' } },
      { html: '<h2>Options</h2>', api: { interface: 'SparklineOptions', defaults: asRecord(SPARKLINE_DEFAULTS) } },
      { html: '<h2>Methods</h2>', api: { class: 'Sparkline' } },
    ],
  },
  {
    id: 'gauge',
    group: 'Gauge',
    title: 'Gauge',
    intro: p('A 200° arc for one probability: value arc from the left, a small gap, the remainder in gray.'),
    sections: [
      { demo: { title: 'Gauge', file: 'gauge' } },
      { html: '<h2>Options</h2>', api: { interface: 'GaugeOptions', defaults: asRecord(GAUGE_DEFAULTS) } },
      { html: '<h2>Methods</h2>', api: { class: 'Gauge' } },
    ],
  },
  {
    id: 'api-chart',
    group: 'Reference',
    title: 'ProbabilityChart API',
    intro: p('Generated from the TypeScript source.'),
    sections: [
      { html: `${code(`new ProbabilityChart(element, options?)`)}<h2>Options</h2>`, api: { interface: 'ProbabilityChartOptions', defaults: asRecord(CHART_DEFAULTS) } },
      { html: '<h2>Methods</h2>', api: { class: 'ProbabilityChart' } },
      { html: '<h2>Series</h2>', api: { interface: 'Series' } },
      { html: '<h2>Hover callback</h2>', api: { interface: 'HoverPoint' } },
    ],
  },
  {
    id: 'api-helpers',
    group: 'Reference',
    title: 'Helpers',
    intro: p('Preparing data, formatting and ticks.'),
    sections: [
      { html: '<h2>Series</h2>', api: { functions: ['backfill', 'alignEnds', 'appendLatest', 'assignColors'] } },
      { html: '<h2>Formatting</h2>', api: { functions: ['formatPercent', 'formatNumber', 'formatCurrency', 'formatValue', 'formatLegendValue', 'formatDate', 'compactParts', 'truncate'] } },
      { html: '<h2>Scales & colors</h2>', api: { functions: ['niceTicks', 'timeTicks', 'mixHsl', 'resolveColor'] } },
    ],
  },
  {
    id: 'api-react',
    group: 'Reference',
    title: 'React',
    intro: p('Thin wrappers around the same classes. Prop changes go through <code>setOptions</code>, so animations survive re-renders.'),
    sections: [
      {
        html: code(`import { ProbabilityChart, Sparkline, Gauge } from 'probable/react'

<ProbabilityChart series={series} labels="auto" theme="auto" />
<Sparkline data={values} color="#2e5cff" floor={0} midline style={{ height: 160 }} />
<Gauge value={0.56} label="56%" />`),
      },
    ],
  },
]

function tokens(el: HTMLElement) {
  const sw = (name: string, light: string, dark: string) =>
    `<div class="swatch"><i style="background:${light}"></i><i style="background:${dark}"></i><span><b>${name}</b></span></div>`
  el.insertAdjacentHTML(
    'beforeend',
    `<div class="swatches">${Object.keys(TOKENS.light)
      .map((k) => sw(`--pb-${k}`, TOKENS.light[k], TOKENS.dark[k]))
      .join('')}</div><h3>Series palette</h3><div class="swatches">${PALETTE_ORDER.map((k) => sw(k, PALETTE[k].light, PALETTE[k].dark)).join('')}</div>`,
  )
}
