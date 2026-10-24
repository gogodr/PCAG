import type { ReactNode } from 'react';
import type { EditorController, EditorView } from '../app/useEditorWorkspace';
import { SceneSwitcher } from '../features/scenes/SceneSwitcher';

const views = ['Project', 'Assets', 'Characters', 'Items', 'Scenes', 'Game Map'] as const;
export function EditorShell({ editor, children }: { editor: EditorController; children: ReactNode }) {
  return <main className="app-shell">
    <aside className="sidebar"><a className="wordmark" href="./" aria-label="PCAG Creator home">PCAG<span>Creator</span></a><p className="sidebar-label">WORKSPACE</p>
      <nav aria-label="Editor views">{views.map(item => {
        const placeholder = item === 'Characters' || item === 'Items' || item === 'Game Map';
        const disabled = !editor.workspace || editor.choosingProject || placeholder;
        return <button type="button" key={item} disabled={disabled} aria-current={!disabled && editor.view === item ? 'page' : undefined} onClick={() => { if (!disabled) editor.setView(item as EditorView); }}>{item}{placeholder && <span>Later</span>}</button>;
      })}</nav><div className="sidebar-bottom">{editor.workspace?.project.name ?? 'No project open'}</div>
    </aside>
    <div className="main-column"><header className="topbar"><div><p className="eyebrow">Editor / {editor.workspace && !editor.choosingProject ? editor.view : 'Start'}</p><div className="topbar-title">{editor.workspace && !editor.choosingProject && editor.view === 'Scenes' ? <><h1>Scenes:</h1><SceneSwitcher editor={editor} /></> : <h1>{editor.workspace && !editor.choosingProject ? editor.view : 'Projects'}</h1>}</div></div><div className="top-actions"><button type="button" onClick={editor.undo} disabled={!editor.workspace || editor.choosingProject || !editor.past.length}>Undo</button><button type="button" onClick={editor.redo} disabled={!editor.workspace || editor.choosingProject || !editor.future.length}>Redo</button></div></header>
      <div className="content">{children}</div>
      <footer><span>PCAG / Creator</span><span>Build your adventure, one scene at a time.</span></footer>
    </div>
  </main>;
}
