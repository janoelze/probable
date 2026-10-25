// Renders reference tables from api.json (generated from src/ by
// scripts/gen-api.mjs) plus the runtime default objects.

import api from './api.json'
import { curveMonotoneX } from 'd3-shape'

export type ApiSpec =
  | { interface: string; defaults?: Record<string, unknown>; skip?: string[] }
  | { class: string }
  | { functions: string[] }

type Api = {
  interfaces: Record<string, { doc: string; props: { name: string; optional: boolean; type: string; doc: string }[] }>
  classes: Record<string, { doc: string; methods: { name: string; signature: string; doc: string }[] }>
  functions: Record<string, { doc: string; signature: string }>
}
const A = api as Api

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const md = (s: string) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\n/g, '<br>')

function fmtDefault(v: unknown): string {
  if (v === undefined) return ''
  if (v === curveMonotoneX) return 'curveMonotoneX'
  if (typeof v === 'function') return v.name || 'ƒ'
  if (typeof v === 'string') return `'${v}'`
  if (Array.isArray(v)) return v.length ? JSON.stringify(v) : '[]'
  return JSON.stringify(v)
}

export function renderApi(el: HTMLElement, spec: ApiSpec) {
  if ('interface' in spec) {
    const i = A.interfaces[spec.interface]
    if (!i) return
    const rows = i.props
      .filter((p) => !spec.skip?.includes(p.name))
      .map((p) => {
        const d = spec.defaults && p.name in spec.defaults ? fmtDefault(spec.defaults[p.name]) : ''
        return `<tr><td class="name"><code>${p.name}</code></td><td><code>${esc(p.type)}</code></td><td>${d ? `<code>${esc(d)}</code>` : ''}</td><td>${md(p.doc)}</td></tr>`
      })
      .join('')
    el.insertAdjacentHTML('beforeend', `${i.doc ? `<p>${md(i.doc)}</p>` : ''}<table class="api"><thead><tr><th>Option</th><th>Type</th><th>Default</th><th>Description</th></tr></thead><tbody>${rows}</tbody></table>`)
  } else if ('class' in spec) {
    const c = A.classes[spec.class]
    if (!c) return
    const rows = c.methods.map((m) => `<tr><td colspan="1"><code>${esc(m.signature)}</code></td><td>${md(m.doc)}</td></tr>`).join('')
    el.insertAdjacentHTML('beforeend', `<table class="api"><thead><tr><th>Method</th><th>Description</th></tr></thead><tbody>${rows}</tbody></table>`)
  } else {
    const rows = spec.functions
      .map((n) => A.functions[n] && `<tr><td><code>${esc(A.functions[n].signature)}</code></td><td>${md(A.functions[n].doc)}</td></tr>`)
      .filter(Boolean)
      .join('')
    el.insertAdjacentHTML('beforeend', `<table class="api"><thead><tr><th>Function</th><th>Description</th></tr></thead><tbody>${rows}</tbody></table>`)
  }
}

