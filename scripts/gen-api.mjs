// Extracts the public API from src/ with the TypeScript compiler: option
// interfaces (props, types, JSDoc), class methods and exported functions.
// Output: site/api.json, consumed by the docs site's reference pages.
//   node scripts/gen-api.mjs

import ts from 'typescript'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const files = fs.readdirSync(path.join(root, 'src')).filter((f) => f.endsWith('.ts')).map((f) => path.join(root, 'src', f))
const program = ts.createProgram(files, { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, strict: true, skipLibCheck: true })

const checker = program.getTypeChecker()
/** JSDoc text via the type checker (works regardless of JSDoc parsing mode). */
const doc = (node) => {
  const sym = node.name ? checker.getSymbolAtLocation(node.name) : undefined
  if (sym) return ts.displayPartsToString(sym.getDocumentationComment(checker)).trim()
  if (ts.isConstructorDeclaration(node)) {
    const sig = checker.getSignatureFromDeclaration(node)
    return sig ? ts.displayPartsToString(sig.getDocumentationComment(checker)).trim() : ''
  }
  return ''
}
const text = (node, sf) => node.getText(sf).replace(/\s+/g, ' ').trim()
const isExported = (node) => (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export) !== 0

const out = { interfaces: {}, classes: {}, functions: {} }

for (const sf of program.getSourceFiles()) {
  if (!sf.fileName.startsWith(path.join(root, 'src'))) continue
  const file = path.relative(root, sf.fileName)
  ts.forEachChild(sf, (node) => {
    if (!isExported(node)) return
    if (ts.isInterfaceDeclaration(node)) {
      out.interfaces[node.name.text] = {
        file,
        doc: doc(node),
        props: node.members.filter(ts.isPropertySignature).map((m) => ({
          name: m.name.getText(sf),
          optional: !!m.questionToken,
          type: m.type ? text(m.type, sf) : 'unknown',
          doc: doc(m),
        })),
      }
    } else if (ts.isClassDeclaration(node) && node.name) {
      const methods = node.members
        .filter((m) => (ts.isMethodDeclaration(m) || ts.isConstructorDeclaration(m)) && !(ts.getCombinedModifierFlags(m) & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)))
        .map((m) => ({
          name: ts.isConstructorDeclaration(m) ? 'constructor' : m.name.getText(sf),
          signature: `${ts.isConstructorDeclaration(m) ? `new ${node.name.text}` : m.name.getText(sf)}(${m.parameters.map((p) => text(p, sf)).join(', ')})${m.type ? `: ${text(m.type, sf)}` : ''}`,
          doc: doc(m),
        }))
      out.classes[node.name.text] = { file, doc: doc(node), methods }
    } else if (ts.isFunctionDeclaration(node) && node.name) {
      out.functions[node.name.text] = {
        file,
        doc: doc(node),
        signature: `${node.name.text}(${node.parameters.map((p) => text(p, sf)).join(', ')})${node.type ? `: ${text(node.type, sf)}` : ''}`,
      }
    }
  })
}

fs.writeFileSync(path.join(root, 'site/api.json'), JSON.stringify(out, null, 1))
console.log(`api.json: ${Object.keys(out.interfaces).length} interfaces, ${Object.keys(out.classes).length} classes, ${Object.keys(out.functions).length} functions`)
