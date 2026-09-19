import { useEffect, useRef } from 'react'
import * as monaco from 'monaco-editor/editor/editor.api.js'
import 'monaco-editor/language/json/monaco.contribution.js'

type Props = { original: string; modified: string; onOriginalChange: (value: string) => void }

export function JsonDiff({ original, modified, onOriginalChange }: Props): React.JSX.Element {
  const container = useRef<HTMLDivElement>(null)
  const onChange = useRef(onOriginalChange)
  onChange.current = onOriginalChange

  useEffect(() => {
    if (!container.current) return
    const originalModel = monaco.editor.createModel(original, 'json')
    const modifiedModel = monaco.editor.createModel(modified, 'json')
    const editor = monaco.editor.createDiffEditor(container.current, {
      theme: 'vs-dark', automaticLayout: true, originalEditable: true, readOnly: true,
      renderSideBySide: true, useInlineViewWhenSpaceIsLimited: false,
      minimap: { enabled: false }, fontSize: 12, scrollBeyondLastLine: false
    })
    editor.setModel({ original: originalModel, modified: modifiedModel })
    const subscription = originalModel.onDidChangeContent(() => onChange.current(originalModel.getValue()))
    return () => { subscription.dispose(); editor.dispose(); originalModel.dispose(); modifiedModel.dispose() }
  }, [])

  return <div className="json-diff-editor" ref={container} aria-label="JSON diff editor" />
}
