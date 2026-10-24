import type { EditorController } from '../app/useEditorWorkspace';

export function ProjectView({ editor }: { editor: EditorController }) {
  const { workspace, directory, saving, ready, exportBusy, edit, exportProject, showWelcome, closeProject, exportCurrent } = editor;
  if (!workspace) return null;
  return <div className="project-view">
    <div className="panel"><h2>Game details</h2><p className="subtle">The settings used by every scene in this project.</p>
      <label>Project name<input value={workspace.project.name} onChange={event => edit(next => { next.project.name = event.target.value; })} /></label>
      <div className="field-pair">
        <label>Target width<input type="number" min="1" max="8192" value={workspace.targetWidth} onChange={event => edit(next => { const value = Number(event.target.value); next.targetWidth = value; next.project.rooms.forEach(scene => { scene.width = value; }); })} /></label>
        <label>Target height<input type="number" min="1" max="8192" value={workspace.targetHeight} onChange={event => edit(next => { const value = Number(event.target.value); next.targetHeight = value; next.project.rooms.forEach(scene => { scene.height = value; }); })} /></label>
      </div>
      <label>Starting scene<select value={workspace.project.startRoomId} onChange={event => edit(next => { next.project.startRoomId = event.target.value; })}>{workspace.project.rooms.map(scene => <option key={scene.id} value={scene.id}>{scene.name}</option>)}</select></label>
    </div>
    <div className="panel"><h2>Project actions</h2><p className="subtle">Working folder: {directory ?? 'Example preview'}. {directory && (saving ? 'Writing changes…' : 'Changes are saved in this folder.')}</p>
      <div className="stack-actions"><button type="button" onClick={() => { void exportProject(); }} disabled={!ready || exportBusy}>Export project</button><button type="button" onClick={() => { void showWelcome(); }}>Open another project</button><button type="button" onClick={() => { void exportCurrent(); }} disabled={!ready || exportBusy}>{exportBusy ? 'Preparing export...' : 'Export player ZIP'}</button><button type="button" onClick={() => { void closeProject(); }}>Close project</button></div>
    </div>
  </div>;
}
