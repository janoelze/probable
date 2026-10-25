# probable

Polished, animated charts for probabilities and forecasts. Framework-agnostic,
built on d3, about 40 kB gzipped. Every visual constant is an option and every
color is a CSS variable.

**Docs and live demos: https://endtime-instruments.org/probable/**

- **`ProbabilityChart`**: lines over time with end labels or a legend, hover pills
  that avoid each other, drag-to-compare, time windows, wrapped labels, number and
  currency modes, gradient lines, area fills, dark mode. Updates morph smoothly.
- **`LiveChart`**: a streaming price line that scrolls in real time, with eased
  ticks, auto-scaling, a target line and a crosshair.
- **`Sparkline`**: compact lines for cards and table rows, with draw-in, a faint
  track, a pulsing end dot and optional scrubbing.
- **`Gauge`**: a 200° arc for a single probability.

## Install

Not on npm yet. Install straight from GitHub (it builds on install):

```sh
npm install github:janoelze/probable
```

Or use it without a build step:

```html
<script type="module">
  import { ProbabilityChart } from 'https://endtime-instruments.org/probable/lib/probable.js'
</script>
```

Load [Inter](https://rsms.me/inter/) for the intended typography.

## Usage

```ts
import { ProbabilityChart } from 'probable'

const chart = new ProbabilityChart(document.getElementById('chart')!, { timeWindows: true })
chart.setSeries([
  { id: 'lin', label: 'Avery Lin', color: 'light-blue', data: [{ time: 1761955200, value: 0.42 } /* … */] },
  { id: 'reyes', label: 'Marcus Reyes', color: 'dark-blue', data: [/* … */] },
])
```

Times are unix seconds; values are 0–1, or any number with `valueFormat: 'number'`.
Call `setSeries()` again with new data and changed lines morph into place.

```ts
import { LiveChart, Sparkline, Gauge } from 'probable'

const live = new LiveChart(el, { color: '#FF9900' })
live.setTarget(64250)
socket.onmessage = (e) => live.push(JSON.parse(e.data).price)

new Sparkline(card, { data: [0.52, 0.55, 0.61, 0.58, 0.64], floor: 0.5 })
new Gauge(badge, { value: 0.56, label: '56%' })
```

React:

```tsx
import { ProbabilityChart, Sparkline, Gauge } from 'probable/react'

<ProbabilityChart series={series} theme="auto" />
```

The full option reference, generated from the source, is on the docs site.

## Styling

All colors are CSS custom properties on `.pb-root`: `--pb-surface`,
`--pb-content-secondary`, `--pb-gray-100` … `--pb-gray-800`, `--pb-border`, and so
on. Light and dark sets are built in (`theme: 'light' | 'dark' | 'auto'`). Set
`--pb-chart-bg` when a chart sits on a non-default background; end labels, pills
and the dashed backfill use it. Series colors are palette keys (`light-blue`,
`dark-blue`, `yellow`, `orange`, `blue`, `red`, `green`), hex values,
`"#light,#dark"` pairs, or any CSS color.

## Development

```sh
npm install
npm run dev        # docs site with live demos at http://127.0.0.1:5199
npm test           # unit tests
npm run build      # dist/ (ESM + .d.ts)
npm run deploy     # build the docs site and upload it
```

## Credits

The visual design is inspired by the charts on [Polymarket](https://polymarket.com).
This is an independent project, not affiliated with or endorsed by Polymarket.

MIT licensed.
