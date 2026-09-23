import { useEffect, useRef } from 'react'
import * as monaco from 'monaco-editor/editor/editor.api.js'
import 'monaco-editor/language/css/monaco.contribution.js'
import 'monaco-editor/language/html/monaco.contribution.js'
import 'monaco-editor/language/json/monaco.contribution.js'
import 'monaco-editor/language/typescript/monaco.contribution.js'
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker'
import CssWorker from 'monaco-editor/language/css/css.worker.js?worker'
import HtmlWorker from 'monaco-editor/language/html/html.worker.js?worker'
import JsonWorker from 'monaco-editor/language/json/json.worker.js?worker'
import TsWorker from 'monaco-editor/language/typescript/ts.worker.js?worker'
import type { GitFileDiff } from '../types'

self.MonacoEnvironment = {
  getWorker: (_moduleId: string, label: string) => {
    if (label === 'json') return new JsonWorker()
    if (label === 'css') return new CssWorker()
    if (label === 'html') return new HtmlWorker()
    if (label === 'typescript' || label === 'javascript') return new TsWorker()
    return new EditorWorker()
  }
}

export function DiffPage({ diff }: { diff: GitFileDiff }): React.JSX.Element {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!container.current || diff.binary || diff.tooLarge || diff.message) return
    const originalModel = monaco.editor.createModel(diff.original, diff.language)
    const modifiedModel = monaco.editor.createModel(diff.modified, diff.language)
    const editor = monaco.editor.createDiffEditor(container.current, {
      theme: 'vs-dark',
      automaticLayout: true,
      readOnly: true,
      renderSideBySide: true,
      useInlineViewWhenSpaceIsLimited: true,
      minimap: { enabled: false },
      fontSize: 12,
      scrollBeyondLastLine: false
    })
    editor.setModel({ original: originalModel, modified: modifiedModel })
    return () => { editor.dispose(); originalModel.dispose(); modifiedModel.dispose() }
  }, [diff])

  return <article className="diff-page" aria-label={`Diff for ${diff.path}`}>
    <header>
      <span>Diff</span>
      <strong title={diff.path}>{diff.path}</strong>
    </header>
    {diff.message
      ? <p>{diff.message}</p>
      : <div ref={container} className="diff-page-editor" />}
  </article>
}
