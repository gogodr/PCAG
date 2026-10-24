import { useState } from 'react';
import type { EditorController } from '../app/useEditorWorkspace';
import { pickProjectFolder } from '../data/browserProjectStore';

type Action = 'create' | 'import' | 'continue';

export function WelcomeView({ editor }: { editor: EditorController }) {
  const [action, setAction] = useState<Action | null>(null);
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [folder, setFolder] = useState<FileSystemDirectoryHandle | null>(null);
  const [busy, setBusy] = useState(false);

  const selectFolder = () => {
    void pickProjectFolder().then(setFolder).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      editor.setMessage(error instanceof Error ? error.message : 'Could not select a folder.');
    });
  };
  const run = async () => {
    if (!folder || !action) return;
    setBusy(true);
    try {
      if (action === 'create') await editor.create(name, folder);
      if (action === 'import') await editor.open(file ?? undefined, folder);
      if (action === 'continue') await editor.openDirectory(folder);
    } finally { setBusy(false); }
  };
  const choose = (next: Action) => { setAction(next); setFolder(null); editor.setMessage(null); };

  return <main className="welcome-page">
    <div className="welcome-brand">PCAG <span>Creator</span></div>
    {!action ? <section className="welcome-intro">
      <p className="eyebrow">POINT-AND-CLICK ADVENTURE CREATOR</p>
      <h1>Build a world worth exploring.</h1>
      <p>PCAG brings your scenes, artwork, and interactions together in a local project folder. Start something new, bring in a shared project, or continue working on a folder you already have.</p>
      <div className="welcome-actions">
        <button type="button" onClick={() => choose('create')}><strong>Create a new project</strong><span>Start with a blank scene in an empty folder.</span></button>
        <button type="button" onClick={() => choose('import')}><strong>Import a PCAG project file</strong><span>Unpack a shared .pcag file into an empty folder.</span></button>
        <button type="button" onClick={() => choose('continue')}><strong>Continue a local project</strong><span>Open a folder containing workspace.json.</span></button>
      </div>
    </section> : <section className="welcome-step">
      <button type="button" className="welcome-back" onClick={() => { setAction(null); setFolder(null); editor.setMessage(null); }}>← All options</button>
      <h1>{action === 'create' ? 'Create a new project' : action === 'import' ? 'Import a PCAG project file' : 'Continue a local project'}</h1>
      <p>{action === 'continue' ? 'Choose the project folder containing workspace.json.' : 'Choose an empty folder where the project files will live.'}</p>
      {action === 'create' && <label>Project name<input autoFocus value={name} onChange={event => setName(event.target.value)} /></label>}
      {action === 'import' && <label>PCAG project file<input type="file" accept=".pcag" aria-label="PCAG project file" onChange={event => setFile(event.target.files?.[0] ?? null)} /></label>}
      <div className="folder-choice"><span>{folder ? `Project folder: ${folder.name}` : 'No project folder selected'}</span><button type="button" onClick={selectFolder}>Select project folder</button></div>
      <button type="button" className="welcome-submit" disabled={busy || !folder || (action === 'create' && !name.trim()) || (action === 'import' && !file)} onClick={() => { void run(); }}>{busy ? 'Opening project…' : action === 'create' ? 'Create project' : action === 'import' ? 'Import project' : 'Continue project'}</button>
    </section>}
    {editor.workspace && <button type="button" className="welcome-return" onClick={editor.returnToProject}>Back to current project</button>}
  </main>;
}
