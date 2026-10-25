// Placeholder data for the docs. Everything here is fictional and generated
// deterministically, so pages look the same on every visit (apart from
// timestamps, which end "now").

import { alignEnds, backfill, type Point, type Series } from '../src/index'

/** Seeded random walk with occasional jumps, clamped to (0.01, 0.99). */
export function walk(seed: number, start: number, opts: { days?: number; stepHours?: number; vol?: number; drift?: number; jumps?: number } = {}): Point[] {
  const { days = 330, stepHours = 12, vol = 0.035, drift = 0, jumps = 0.02 } = opts
  const now = Math.floor(Date.now() / 1000)
  const t0 = now - days * 86400
  let x = seed * 9301 + 49297
  const rnd = () => ((x = (x * 16807) % 2147483647) / 2147483647)
  let v = start
  const out: Point[] = []
  for (let t = t0; t <= now; t += stepHours * 3600) {
    v += (rnd() - 0.5) * vol + drift
    if (rnd() < jumps) v += (rnd() - 0.5) * 0.25
    v = Math.min(0.99, Math.max(0.01, v))
    out.push({ time: t, value: +v.toFixed(3) })
  }
  return out
}

/** Normalise several walks so they sum to ~1 at every step (mutually exclusive outcomes). */
function shares(walks: Point[][]): Point[][] {
  return walks.map((w, i) =>
    w.map((p, j) => {
      const total = walks.reduce((s, other) => s + (other[j]?.value ?? 0), 0) || 1
      return { time: p.time, value: +(walks[i][j].value / total).toFixed(3) }
    }),
  )
}

/** Two candidates in a fictional mayoral race; the second enters later (dashed backfill). */
export function mayorRace(): Series[] {
  const [a, b] = shares([walk(3, 0.55, { drift: -0.0006 }), walk(8, 0.4, { drift: 0.0008 })])
  const late = b.slice(70)
  const filled = backfill([a, late])
  return alignEnds([
    { id: 'lin', label: 'Avery Lin', color: 'light-blue', data: filled[0].data, decimals: 1 },
    { id: 'reyes', label: 'Marcus Reyes', color: 'dark-blue', data: filled[1].data, backfilledData: filled[1].backfilled },
  ])
}

/** Four outcomes of a fictional central-bank decision. */
export function rateDecision(): Series[] {
  const raw = shares([walk(11, 0.35, { drift: 0.0012 }), walk(17, 0.3), walk(23, 0.2, { drift: -0.0004 }), walk(29, 0.15, { drift: -0.0005 })])
  const labels = ['Hold', 'Cut 25 bps', 'Cut 50 bps', 'Hike 25 bps']
  return raw
    .map((d, i) => ({ id: `r${i}`, label: labels[i], color: '', data: d, decimals: 1 }))
    .sort((a, b) => b.data[b.data.length - 1].value - a.data[a.data.length - 1].value)
    .map((s, i) => ({ ...s, color: ['light-blue', 'dark-blue', 'yellow', 'orange'][i] }))
}

/** A single yes/no question drifting down over time. */
export function yesNo(): Series[] {
  return [{ id: 'yes', label: 'Yes', color: 'blue', data: walk(5, 0.32, { drift: -0.0008, vol: 0.02 }), decimals: 1 }]
}

/** A yes/no question trending up, for the gradient demo. */
export function rising(): Series[] {
  const d = walk(31, 0.12, { vol: 0.025 }).map((p, i, all) => ({ ...p, value: Math.min(0.97, +(p.value + (0.72 * i) / all.length).toFixed(3)) }))
  return [{ id: 'yes', label: 'Yes', color: 'blue', data: d, decimals: 1 }]
}

/** A fictional game, kickoff 2h ago, 1-minute points; long team names wrap. */
export function game(): Series[] {
  const now = Math.floor(Date.now() / 1000)
  const start = now - 2 * 3600
  let x = 77
  const rnd = () => ((x = (x * 16807) % 2147483647) / 2147483647)
  let v = 0.56
  const home: Point[] = []
  for (let t = start; t <= now; t += 60) {
    v = Math.min(0.97, Math.max(0.03, v + (rnd() - 0.5) * 0.03 + (rnd() < 0.03 ? (rnd() - 0.45) * 0.2 : 0)))
    home.push({ time: t, value: +v.toFixed(3) })
  }
  const away = home.map((p) => ({ time: p.time, value: +(1 - p.value).toFixed(3) }))
  return [
    { id: 'home', label: 'North Shore Mariners', color: '#E04000', data: home },
    { id: 'away', label: 'Valley Comets', color: '#4040A0', data: away },
  ].sort((a, b) => b.data[b.data.length - 1].value - a.data[a.data.length - 1].value)
}

/** A numeric forecast (e.g. season ticket sales), 10-minute points over 14 days. */
export function forecast(): Series[] {
  const now = Math.floor(Date.now() / 1000)
  let x = 41
  const rnd = () => ((x = (x * 16807) % 2147483647) / 2147483647)
  let v = 6420
  const data: Point[] = []
  for (let t = now - 14 * 86400; t <= now; t += 600) {
    v += (rnd() - 0.48) * 6
    data.push({ time: t, value: Math.round(v) })
  }
  return [{ id: 'forecast', label: '', color: 'var(--pb-brand-500)', data, decimals: 0 }]
}

/** Live price simulator: emits a value every second around `start`. */
export function priceFeed(start = 64250, seed = 13) {
  let x = seed
  const rnd = () => ((x = (x * 16807) % 2147483647) / 2147483647)
  let v = start
  const next = () => (v = +(v + (rnd() - 0.5) * 9 + (rnd() < 0.05 ? (rnd() - 0.5) * 30 : 0)).toFixed(2))
  const history = (seconds: number): Point[] => {
    const now = Math.floor(Date.now() / 1000)
    return Array.from({ length: seconds }, (_, i) => ({ time: now - seconds + i, value: next() }))
  }
  return { next, history }
}

/** 14 days of 3-hour points as plain values (sparklines). */
export function sparkValues(seed: number, start: number, drift = 0): number[] {
  return walk(seed, start, { days: 14, stepHours: 3, vol: 0.02, drift, jumps: 0.03 }).map((p) => p.value)
}
