import { useEffect, useRef, useState } from 'react';
import type { Element, SceneEvent, StateVariables } from '../../../../../packages/project-format/src/index';
import { eventFunctionName } from '../../../../../packages/scene-events/src/index';
import { scriptEditorTypes } from './scriptEditorTypes';
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker.js?worker';
import TypeScriptWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker.js?worker';

type MonacoGlobal = typeof globalThis & { MonacoEnvironment?: { getWorker: (_id: string, label: string) => Worker } };
(globalThis as MonacoGlobal).MonacoEnvironment = {
  getWorker: (_id, label) => label === 'javascript' || label === 'typescript' ? new TypeScriptWorker() : new EditorWorker(),
};

monaco.editor.defineTheme('pcag-script', {
  base: 'vs-dark', inherit: true,
  rules: [
    { token: '', foreground: 'F6E2AE' },
    { token: 'comment', foreground: '91A7AD', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'F1C777' },
    { token: 'string', foreground: '71C5B4' },
    { token: 'number', foreground: 'E8A88A' },
    { token: 'type.identifier', foreground: '8FD4D2' },
  ],
  colors: {
    'editor.background': '#111C2C',
    'editor.foreground': '#F6E2AE',
    'editorCursor.foreground': '#F1C777',
    'editor.lineHighlightBackground': '#233650',
    'editorLineNumber.foreground': '#748D9A',
    'editorLineNumber.activeForeground': '#F1C777',
    'editor.selectionBackground': '#34526C',
    'editor.inactiveSelectionBackground': '#2A435A',
    'editorIndentGuide.background1': '#34526C',
    'editorIndentGuide.activeBackground1': '#71C5B4',
    'editorWidget.background': '#182337',
    'editorWidget.border': '#55798B',
    'editorSuggestWidget.background': '#182337',
    'editorSuggestWidget.border': '#55798B',
    'editorSuggestWidget.foreground': '#F6E2AE',
    'editorSuggestWidget.selectedBackground': '#34526C',
    'editorSuggestWidget.highlightForeground': '#F1C777',
    'editorHoverWidget.background': '#182337',
    'editorHoverWidget.border': '#55798B',
    'input.background': '#111C2C',
    'input.foreground': '#F6E2AE',
    'focusBorder': '#C8954D',
    'scrollbarSlider.background': '#55798B66',
    'scrollbarSlider.hoverBackground': '#55798BAA',
  },
});
monaco.typescript.javascriptDefaults.setCompilerOptions({ allowNonTsExtensions: true, checkJs: true, noLib: false });

interface Props { event: SceneEvent; sceneState: StateVariables; gameState: StateVariables; elements: Element[]; onClose: () => void; onSave: (script: string) => void }

export default function ScriptEditorDialog({ event, sceneState, gameState, elements, onClose, onSave }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [script, setScript] = useState(event.script);
  useEffect(() => {
    if (!host.current) return;
    const typeLibrary = monaco.typescript.javascriptDefaults.addExtraLib(scriptEditorTypes(sceneState, gameState), `pcag-scene-api-${event.id}.d.ts`);
    const uri = monaco.Uri.parse(`inmemory://pcag/script/${event.id}.js`);
    const model = monaco.editor.createModel(event.script, 'javascript', uri);
    const completionProvider = monaco.languages.registerCompletionItemProvider('javascript', {
      triggerCharacters: ['.'],
      provideCompletionItems(currentModel, position) {
        if (currentModel.uri.toString() !== uri.toString()) return { suggestions: [] };
        const before = currentModel.getValueInRange({ startLineNumber: position.lineNumber, startColumn: 1, endLineNumber: position.lineNumber, endColumn: position.column });
        const path = /(?:^|[^\w.])(scene(?:\.state|\.elements)?|game\.state|trigger)\.([A-Za-z0-9_]*)$/.exec(before);
        if (!path) return { suggestions: [] };
        const word = currentModel.getWordUntilPosition(position);
        const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
        if (path[1] === 'scene.elements') {
          const counts = new Map<string, number>();
          const ids = new Set(elements.map(element => element.game_id));
          for (const element of elements) counts.set(element.element_id, (counts.get(element.element_id) ?? 0) + 1);
          const bracketRange = new monaco.Range(position.lineNumber, word.startColumn - 1, position.lineNumber, word.endColumn);
          return { suggestions: elements.map((element, index) => {
            const key = counts.get(element.element_id) === 1 && !ids.has(element.element_id) ? element.element_id : element.game_id;
            return {
              label: element.element_id, detail: `${element.name ?? element.element_id} (${element.game_id})`, filterText: `.${element.element_id}`,
              kind: monaco.languages.CompletionItemKind.Value,
              insertText: `[${JSON.stringify(key)}]`, range: bracketRange,
              sortText: String(index).padStart(4, '0'),
            };
          }) };
        }
        const names = path[1] === 'scene' ? ['state', 'elements']
          : path[1] === 'scene.state' ? Object.keys(sceneState)
            : path[1] === 'game.state' ? Object.keys(gameState)
              : ['type', 'action', 'target', 'item', 'old_value', 'value', 'x', 'y', 'phase'];
        return { suggestions: names.map((label, index) => ({
          label, kind: monaco.languages.CompletionItemKind.Property, insertText: label, range,
          sortText: String(index).padStart(4, '0'),
        })) };
      },
    });
    const editor = monaco.editor.create(host.current, {
      model, theme: 'pcag-script', automaticLayout: true, fontSize: 13,
      minimap: { enabled: false }, scrollBeyondLastLine: false, wordWrap: 'on', tabSize: 2,
      occurrencesHighlight: 'off', selectionHighlight: false,
    });
    const subscription = editor.onDidChangeModelContent(() => setScript(editor.getValue()));
    editor.focus();
    return () => { subscription.dispose(); editor.dispose(); completionProvider.dispose(); model.dispose(); typeLibrary.dispose(); };
  }, [event.id, sceneState, gameState, elements]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [onClose]);
  return <div className="scene-script-backdrop"><div className="scene-script-dialog" role="dialog" aria-modal="true" aria-label={`Script for ${event.name}`}>
    <div className="scene-script-header"><div><h2>{event.name}</h2><p className="subtle">Edit <code>{eventFunctionName(event.id)}(scene, game, trigger)</code> as an async function. Use <code>await</code> for animation methods and JavaScript <code>true</code> and <code>false</code>.</p></div><button type="button" aria-label="Close script editor" onClick={onClose}>×</button></div>
    <div ref={host} className="scene-script-monaco" aria-label="JavaScript script editor" />
    <div className="scene-script-footer"><span className="subtle">State: scene.state, game.state · Elements: scene.elements</span><button type="button" onClick={onClose}>Cancel</button><button type="button" onClick={() => onSave(script)}>Save Script</button></div>
  </div></div>;
}
