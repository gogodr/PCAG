import { lazy, Suspense, useEffect, useState } from 'react';
import { useEditorWorkspace } from './useEditorWorkspace';
import { Diagnostics } from '../components/Diagnostics';
import { EditorShell } from '../components/EditorShell';
import { AssetsView } from '../views/AssetsView';
import { CharactersView } from '../views/CharactersView';
import { ProjectView } from '../views/ProjectView';
import { ScenesView } from '../views/ScenesView';
import { WelcomeView } from '../views/WelcomeView';
import type { EditorView } from './editorViews';

type Editor = ReturnType<typeof useEditorWorkspace>;
const AnimationsView = lazy(() => import('../views/AnimationsView').then(module => ({ default: module.AnimationsView })));
const Preview = lazy(() => import('../components/Preview').then(module => ({ default: module.Preview })));

function ActiveView({ editor, view }: { editor: Editor; view: EditorView }) {
  switch (view) {
    case 'Project': return <ProjectView editor={editor} />;
    case 'Assets': return <AssetsView editor={editor} />;
    case 'Characters': return <CharactersView editor={editor} />;
    case 'Scenes': return <ScenesView editor={editor} />;
    case 'Animations': return null;
  }
}

export function CreatorApp() {
  const editor = useEditorWorkspace();
  const [animationsOpened, setAnimationsOpened] = useState(false);
  useEffect(() => { if (editor.view === 'Animations') setAnimationsOpened(true); }, [editor.view]);
  if (editor.loading) return <main className="loading-screen" role="status">Opening workspace…</main>;
  return <>
    {!editor.workspace || editor.choosingProject ? <WelcomeView editor={editor} /> : <EditorShell editor={editor}>
      <ActiveView editor={editor} view={editor.view} />
      {animationsOpened && <Suspense fallback={<p role="status">Opening animation tools…</p>}><AnimationsView editor={editor} active={editor.view === 'Animations'} /></Suspense>}
      {editor.preview && <div className="preview-wrap"><Suspense fallback={<p role="status">Opening preview…</p>}><Preview key={editor.preview.run} project={editor.preview.project} urls={editor.preview.urls} onClose={() => editor.setPreview(null)} /></Suspense><button type="button" onClick={editor.startPreview}>Restart preview</button></div>}
    </EditorShell>}
    <Diagnostics editor={editor} />
  </>;
}
