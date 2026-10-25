// Docs site: hash router, nav, demo blocks (preview / code / reference) and
// generated API tables. Demos live in ./demos and are shown with their source.

import { PAGES, GROUPS, type Demo } from './pages'
import { renderApi } from './api'
import { highlight } from './util'
import type { ThemeName } from '../src/index'

export interface DemoContext {
  theme: ThemeName
  /** Register something with setOptions({theme}) so the theme toggle reaches it. */
  track<T extends { setOptions(o: { theme: ThemeName }): void; destroy(): void }>(x: T): T
  status(text: string): void
}

const demoModules = import.meta.glob<{ default: (el: HTMLElement, ctx: DemoContext) => unknown }>('./demos/*.ts')
const demoSources = import.meta.glob<string>('./demos/*.ts', { query: '?raw', import: 'default', eager: true })

const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T

// ── theme ──────────────────────────────────────────────────────────────────

let theme: ThemeName = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
let live: { setOptions(o: { theme: ThemeName }): void; destroy(): void }[] = []

function setTheme(t: ThemeName) {
  theme = t
  document.documentElement.dataset.theme = t
  try { localStorage.setItem('probable-docs-theme', t) } catch {}
  document.querySelectorAll<HTMLButtonElement>('#theme button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === t)))
  live.forEach((x) => x.setOptions({ theme: t }))
}
document.querySelectorAll<HTMLButtonElement>('#theme button').forEach((b) => (b.onclick = () => setTheme(b.dataset.v as ThemeName)))
setTheme(theme)

// ── nav ────────────────────────────────────────────────────────────────────

function buildNav() {
  const toc = $('#toc')
  for (const g of GROUPS) {
    const h = document.createElement('h4')
    h.textContent = g
    toc.append(h)
    for (const p of PAGES.filter((p) => p.group === g)) {
      const a = document.createElement('a')
      a.className = 'item'
      a.href = `#/${p.id}`
      a.dataset.id = p.id
      a.innerHTML = `${p.title}${p.tag ? `<span class="tag">${p.tag}</span>` : ''}`
      toc.append(a)
    }
  }
  $('#menu').onclick = () => $('#nav').classList.toggle('open')
}

/** Demo source as a reader would write it: package import, no site plumbing. */
function displaySource(src: string): string {
  return src
    .replace(/from '\.\.\/\.\.\/src\/index'/g, "from 'probable'")
    .replace(/from '\.\.\/data'/g, "from './placeholder-data'")
    .replace(/^import type \{ DemoContext \} from '\.\.\/main'\n/m, '')
    .replace(/^\/\/ @demo[^\n]*\n/gm, '')
    .trim()
}

// ── page rendering ─────────────────────────────────────────────────────────

async function mountDemo(container: HTMLElement, d: Demo) {
  const block = document.createElement('section')
  block.className = 'demo'
  const tabs = ['Preview', 'Code']
  block.innerHTML = `
    <div class="demo-head"><span class="demo-title">${d.title}</span>
      <span class="demo-tabs">${tabs.map((t, i) => `<button data-tab="${i}" aria-pressed="${i === 0}">${t}</button>`).join('')}</span></div>
    <div class="demo-body" data-pane="0"><div class="chart-host"${d.width ? ` style="width:${d.width}px"` : ''}></div><div class="status"></div></div>
    <div class="demo-body flush" data-pane="1" hidden><pre>${highlight(displaySource(demoSources[`./demos/${d.file}.ts`] ?? ''))}</pre></div>
    ${d.note ? `<div class="demo-note">${d.note}</div>` : ''}`
  container.append(block)
  block.querySelectorAll<HTMLButtonElement>('.demo-tabs button').forEach((b) => {
    b.onclick = () => {
      block.querySelectorAll<HTMLButtonElement>('.demo-tabs button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)))
      block.querySelectorAll<HTMLElement>('[data-pane]').forEach((p) => (p.hidden = p.dataset.pane !== b.dataset.tab))
    }
  })
  const host = $('.chart-host', block)
  const status = $('.status', block)
  const mod = await demoModules[`./demos/${d.file}.ts`]?.()
  if (!mod) return
  const ctx: DemoContext = {
    theme,
    track: (x) => (live.push(x), x),
    status: (t) => (status.textContent = t),
  }
  try {
    await mod.default(host, ctx)
  } catch (e) {
    status.textContent = `Error: ${e instanceof Error ? e.message : String(e)}`
  }
}

function render() {
  const id = location.hash.replace(/^#\/?/, '') || 'overview'
  const page = PAGES.find((p) => p.id === id) ?? PAGES[0]
  live.forEach((x) => x.destroy())
  live = []
  document.querySelectorAll<HTMLAnchorElement>('#toc a').forEach((a) => a.toggleAttribute('aria-current', a.dataset.id === page.id))
  document.querySelectorAll<HTMLAnchorElement>('#toc a[aria-current]').forEach((a) => a.setAttribute('aria-current', 'page'))
  $('#crumbs').textContent = `${page.group} / ${page.title}`
  $('#nav').classList.remove('open')
  document.title = page.id === 'overview' ? 'probable' : `${page.title} · probable`
  const el = $('#page')
  el.innerHTML = `<h1>${page.title}</h1>${page.intro ?? ''}`
  window.scrollTo(0, 0)
  const sections = page.sections ?? []
  ;(async () => {
    for (const s of sections) {
      if (s.html) el.insertAdjacentHTML('beforeend', s.html)
      if (s.demo) await mountDemo(el, s.demo).catch(console.error)
      if (s.api) renderApi(el, s.api)
      if (s.custom) await s.custom(el, { theme, track: (x) => (live.push(x), x), status() {} })
    }
  })()
}

buildNav()
addEventListener('hashchange', render)
render()
