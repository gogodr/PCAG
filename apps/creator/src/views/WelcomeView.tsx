import { useState } from 'react';
import type { EditorController } from '../app/useEditorWorkspace';
import { Brand } from '../components/Brand';
import { UiIcon } from '../components/UiIcon';
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
    <header className="welcome-header"><Brand /><span>THE ADVENTURE WORKBENCH</span></header>
    {!action ? <section className="welcome-intro">
      <div className="welcome-copy"><p className="eyebrow">THE STORY STARTS HERE</p>
        <h1>Make worlds<br /><em>worth exploring.</em></h1>
        <p>Build a point-and-click adventure, one curious detail at a time.</p>
        <div className="welcome-actions">
          <div className="welcome-create-card"><span className="welcome-card-number">01</span><div><strong>CREATE AN ADVENTURE</strong><span>Scene · Character · Mystery</span></div><button className="welcome-create" type="button" aria-label="Create a new project" onClick={() => choose('create')}><UiIcon name="add" />New project</button></div>
          <div className="welcome-secondary-actions"><button type="button" aria-label="Import a PCAG project file" onClick={() => choose('import')}><UiIcon name="upload-file" /><span><strong>Import PCAG file</strong><small>Bring in a shared adventure</small></span></button>
            <button type="button" aria-label="Continue a local project" onClick={() => choose('continue')}><UiIcon name="history" /><span><strong>Continue locally</strong><small>Pick up where you left off</small></span></button></div>
        </div>
      </div>
      <figure className="welcome-art"><div className="welcome-art-frame"><img src={`${import.meta.env.BASE_URL}art/adventure-workbench-v2.png`} alt="Pixel art archway with moonlit ruins, maps, a compass, and a lantern" /></div><figcaption className="welcome-art-caption"><span>THE ADVENTURE WORKBENCH</span><span>Scenes · Stories · Secrets</span></figcaption></figure>
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
