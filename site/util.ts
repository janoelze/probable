const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Tiny TS highlighter for the code tabs: comments, strings, keywords, numbers. */
export function highlight(src: string): string {
  return esc(src).replace(
    /(\/\/[^\n]*)|('(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(import|from|export|default|const|let|await|async|function|return|new|if|else|for|of|true|false|null|undefined)\b|\b(\d+(?:\.\d+)?)\b/g,
    (m, c, str, k, n) => (c ? `<span class="tok-c">${m}</span>` : str ? `<span class="tok-s">${m}</span>` : k ? `<span class="tok-k">${m}</span>` : n ? `<span class="tok-n">${m}</span>` : m),
  )
}
