import { useEffect, useRef } from 'react'
import * as monaco from 'monaco-editor/editor/editor.api.js'
import 'monaco-editor/language/json/monaco.contribution.js'
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker'
import JsonWorker from 'monaco-editor/language/json/json.worker.js?worker'

self.MonacoEnvironment = {
  getWorker: (_moduleId: string, label: string) => label === 'json' ? new JsonWorker() : new EditorWorker()
}

type Props = { value: string; onChange: (value: string) => void; readOnly?: boolean }

export function JsonEditor({ value, onChange, readOnly = false }: Props): React.JSX.Element {
  const container = useRef<HTMLDivElement>(null)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => { editorRef.current?.updateOptions({ readOnly }) }, [readOnly])

  useEffect(() => {
    const node = container.current
    if (!node) return
    const editor = monaco.editor.create(node, {
      value, language: 'json', theme: 'vs-dark', automaticLayout: true, readOnly,
      minimap: { enabled: false }, fontSize: 12, lineNumbers: 'off',
      scrollBeyondLastLine: false, wordWrap: 'on', padding: { top: 8, bottom: 8 }
    })
    editorRef.current = editor
    const subscription = editor.onDidChangeModelContent(() => onChangeRef.current(editor.getValue()))
    return () => { subscription.dispose(); editor.dispose(); editorRef.current = null }
  }, [])

  return <div ref={container} className="api-json-editor" aria-label="JSON request body" />
}
