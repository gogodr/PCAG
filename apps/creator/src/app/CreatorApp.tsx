import { useEditorWorkspace } from './useEditorWorkspace';
import { Diagnostics } from '../components/Diagnostics';
import { EditorShell } from '../components/EditorShell';
import { Preview } from '../components/Preview';
import { AssetsView } from '../views/AssetsView';
import { ProjectView } from '../views/ProjectView';
import { ScenesView } from '../views/ScenesView';
import { WelcomeView } from '../views/WelcomeView';

export function CreatorApp() {
  const editor = useEditorWorkspace();
  return <>
    {!editor.loading && (!editor.workspace || editor.choosingProject) ? <WelcomeView editor={editor} /> : <EditorShell editor={editor}>
    {editor.workspace && !editor.choosingProject && editor.view === 'Project' && <ProjectView editor={editor} />}
    {editor.workspace && !editor.choosingProject && editor.view === 'Assets' && <AssetsView editor={editor} />}
    {editor.workspace && !editor.choosingProject && editor.view === 'Scenes' && <ScenesView editor={editor} />}
    {editor.preview && <div className="preview-wrap"><Preview key={editor.preview.run} project={editor.preview.project} urls={editor.preview.urls} onClose={() => editor.setPreview(null)} /><button type="button" onClick={editor.startPreview}>Restart preview</button></div>}
    </EditorShell>}
    <Diagnostics editor={editor} />
  </>;
}
