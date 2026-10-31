import type { ReactNode } from 'react';
import type { EditorController } from '../app/useEditorWorkspace';
import { editorViews, viewDescription } from '../app/editorViews';
import { SceneSwitcher } from '../features/scenes/SceneSwitcher';
import { Brand } from './Brand';
import { UiIcon } from './UiIcon';

export function EditorShell({ editor, children }: { editor: EditorController; children: ReactNode }) {
  const projectName = editor.workspace?.project.name || 'Untitled project';
  return <main className="app-shell">
    <aside className="sidebar"><a className="sidebar-brand" href="./" aria-label="PCAG Creator home"><Brand compact /></a>
      <div className="sidebar-project"><span className="sidebar-caption">Current project</span><strong title={projectName}>{projectName}</strong></div>
      <nav aria-label="Editor views"><span className="sidebar-caption">THE WORKBENCH</span>{editorViews.map(item => <button type="button" key={item.id} aria-current={editor.view === item.id ? 'page' : undefined} onClick={() => editor.setView(item.id)}><UiIcon name={item.icon} />{item.label}</button>)}</nav>
      <div className="sidebar-bottom"><span className={`save-indicator${editor.saving ? ' is-saving' : ''}`} aria-hidden="true" />{editor.directory ? editor.saving ? 'Saving changes…' : 'Saved to project folder' : 'Sample workspace'}</div>
    </aside>
    <div className="main-column"><header className="topbar"><div className="topbar-context"><p className="eyebrow">{projectName} / {editor.view}</p><div className="topbar-title"><h1>{editor.view}</h1>{editor.view === 'Scenes' && <SceneSwitcher editor={editor} />}</div><p className="topbar-description">{viewDescription(editor.view)}</p></div>{editor.view !== 'Animations' && <div className="top-actions" aria-label="Edit history"><button type="button" onClick={editor.undo} disabled={!editor.past.length} title="Undo last edit">Undo</button><button type="button" onClick={editor.redo} disabled={!editor.future.length} title="Redo last edit">Redo</button></div>}</header>
      <div className={`content${editor.view === 'Animations' ? ' animation-content' : ''}`}>{children}</div>
    </div>
  </main>;
}
