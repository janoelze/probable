// Minimal animation primitives: eased tweens, damped springs, and SVG
// pathLength/pathOffset helpers. Named easings use the usual cubic-beziers.

export type Easing = (t: number) => number

function bezier(x1: number, y1: number, x2: number, y2: number): Easing {
  const sample = (a1: number, a2: number, t: number) => ((1 - 3 * a2 + 3 * a1) * t + (3 * a2 - 6 * a1)) * t * t + 3 * a1 * t
  return (x) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let lo = 0
    let hi = 1
    let t = x
    for (let i = 0; i < 24; i++) {
      const v = sample(x1, x2, t)
      if (Math.abs(v - x) < 1e-6) break
      if (v < x) lo = t
      else hi = t
      t = (lo + hi) / 2
    }
    return sample(y1, y2, t)
  }
}

export const ease = {
  linear: (t: number) => t,
  easeIn: bezier(0.42, 0, 1, 1),
  easeOut: bezier(0, 0, 0.58, 1),
  easeInOut: bezier(0.42, 0, 0.58, 1),
  easeOutExpo: (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t)),
  easeOutCubic: (t: number) => 1 - (1 - t) ** 3,
  /** Shape of the live chart's one-second segments along x. */
  easeInOutCubicApprox: bezier(0.65, 0, 0.35, 1),
}

export interface Cancel { (): void }

const raf = (cb: FrameRequestCallback) => (typeof requestAnimationFrame === 'undefined' ? (setTimeout(() => cb(performance.now()), 16) as unknown as number) : requestAnimationFrame(cb))
const caf = (id: number) => (typeof cancelAnimationFrame === 'undefined' ? clearTimeout(id) : cancelAnimationFrame(id))

/** Tween 0→1 over `duration` ms; `onUpdate` receives the eased progress. */
export function tween(opts: { duration: number; delay?: number; ease?: Easing; onUpdate: (p: number) => void; onComplete?: () => void }): Cancel {
  const { duration, delay = 0, ease: e = ease.easeOut, onUpdate, onComplete } = opts
  let id = 0
  let start = -1
  const step = (now: number) => {
    if (start < 0) start = now + delay
    const t = duration <= 0 ? 1 : Math.min(1, Math.max(0, (now - start) / duration))
    if (now >= start) onUpdate(e(t))
    if (t < 1 || now < start) id = raf(step)
    else onComplete?.()
  }
  id = raf(step)
  return () => caf(id)
}

/** Damped spring from `from` to `to` (stiffness / damping / mass). */
export function spring(opts: { from: number; to: number; velocity?: number; stiffness?: number; damping?: number; mass?: number; onUpdate: (v: number) => void; onComplete?: () => void }): Cancel {
  const { to, stiffness = 100, damping = 10, mass = 1, onUpdate, onComplete } = opts
  let x = opts.from
  let v = opts.velocity ?? 0
  let last = -1
  let id = 0
  const step = (now: number) => {
    const dt = last < 0 ? 1 / 60 : Math.min(0.064, (now - last) / 1000)
    last = now
    // Fixed sub-steps keep stiff springs (stiffness 1300) stable.
    const n = Math.ceil(dt / 0.002)
    const h = dt / n
    for (let i = 0; i < n; i++) {
      const a = (-stiffness * (x - to) - damping * v) / mass
      v += a * h
      x += v * h
    }
    if (Math.abs(x - to) < 0.01 && Math.abs(v) < 0.05) {
      onUpdate(to)
      onComplete?.()
      return
    }
    onUpdate(x)
    id = raf(step)
  }
  id = raf(step)
  return () => caf(id)
}

/**
 * Draws `length` (0–1) of a path starting at `offset` (0–1): normalises the
 * path with `pathLength="1"` and drives dasharray/dashoffset.
 */
export function setPathLength(el: SVGPathElement, length: number, offset = 0) {
  el.setAttribute('pathLength', '1')
  el.style.strokeDasharray = `${length} 1`
  el.style.strokeDashoffset = `${-offset}`
}

export function clearPathLength(el: SVGPathElement) {
  el.removeAttribute('pathLength')
  el.style.strokeDasharray = ''
  el.style.strokeDashoffset = ''
}
