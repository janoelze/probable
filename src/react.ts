// Thin React bindings. The chart instance lives in a ref; prop changes are
// forwarded with setOptions so animations (morphs, pulses) survive re-renders.

import { createElement, useEffect, useRef, type CSSProperties } from 'react'
import { ProbabilityChart as Chart, type ProbabilityChartOptions } from './probability-chart'
import { Sparkline as Spark, type SparklineOptions } from './sparkline'
import { Gauge as G, type GaugeOptions } from './gauge'

interface Instance<O> {
  setOptions(o: Partial<O>): void
  destroy(): void
}

function useInstance<O>(create: (el: HTMLElement, o: O) => Instance<O>, options: O) {
  const ref = useRef<HTMLDivElement>(null)
  const inst = useRef<Instance<O> | null>(null)
  useEffect(() => {
    if (!ref.current) return
    inst.current = create(ref.current, options)
    return () => {
      inst.current?.destroy()
      inst.current = null
    }
    // Created once; later changes go through setOptions below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    inst.current?.setOptions(options)
  })
  return ref
}

interface Common {
  className?: string
  style?: CSSProperties
}

export type ProbabilityChartProps = ProbabilityChartOptions & Common
export type SparklineProps = SparklineOptions & Common
export type GaugeProps = GaugeOptions & Common

/** `<ProbabilityChart series={…} />`: pass new `series` to update (paths morph). */
export function ProbabilityChart({ className, style, ...options }: ProbabilityChartProps) {
  const ref = useInstance<ProbabilityChartOptions>((el, o) => new Chart(el, o), options)
  return createElement('div', { ref, className, style })
}

export function Sparkline({ className, style, ...options }: SparklineProps) {
  const ref = useInstance<SparklineOptions>((el, o) => new Spark(el, o), options)
  return createElement('div', { ref, className, style })
}

export function Gauge({ className, style, ...options }: GaugeProps) {
  const ref = useInstance<GaugeOptions>((el, o) => new G(el, o), options)
  return createElement('div', { ref, className, style })
}
