import type { EditorController } from '../app/useEditorWorkspace';
import { UiIcon } from '../components/UiIcon';

export function ProjectView({ editor }: { editor: EditorController }) {
  const { workspace, directory, saving, ready, exportBusy, edit, exportProject, showWelcome, closeProject, exportCurrent, startPreview } = editor;
  if (!workspace) return null;
  return <div className="project-view">
    <div className="panel project-details"><p className="panel-kicker">01 / GAME SETUP</p><h2>Game details</h2><p className="subtle">The settings used by every scene in this project.</p>
      <label>Project name<input value={workspace.project.name} onChange={event => edit(next => { next.project.name = event.target.value; })} /></label>
      <div className="field-pair">
        <label>Target width<input type="number" min="1" max="8192" value={workspace.targetWidth} onChange={event => edit(next => { const value = Number(event.target.value); next.targetWidth = value; next.project.rooms.forEach(scene => { scene.width = value; }); })} /></label>
        <label>Target height<input type="number" min="1" max="8192" value={workspace.targetHeight} onChange={event => edit(next => { const value = Number(event.target.value); next.targetHeight = value; next.project.rooms.forEach(scene => { scene.height = value; }); })} /></label>
      </div>
      <label>Starting scene<select value={workspace.project.startRoomId} onChange={event => edit(next => { next.project.startRoomId = event.target.value; })}>{workspace.project.rooms.map(scene => <option key={scene.id} value={scene.id}>{scene.name}</option>)}</select></label>
    </div>
    <div className="panel project-actions"><p className="panel-kicker">02 / PUBLISH & PLAY</p><h2>Ready for adventure?</h2><p className="subtle">Preview your game, then package it for players.</p>
      <div className="project-status"><span className={`project-status-light${ready ? ' is-ready' : ''}`} aria-hidden="true" /><div><strong>{ready ? 'Ready to play' : 'Needs attention'}</strong><small>{directory ?? 'Example preview'} · {saving ? 'Saving changes…' : 'Up to date'}</small></div></div>
      <div className="stack-actions"><button type="button" onClick={startPreview} disabled={!ready}><UiIcon name="play-arrow" />Preview game</button><button type="button" className="secondary-action" onClick={() => { void exportCurrent(); }} disabled={!ready || exportBusy}><UiIcon name="ios-share" />{exportBusy ? 'Preparing export…' : 'Export player ZIP'}</button><button type="button" className="secondary-action" onClick={() => { void exportProject(); }} disabled={!ready || exportBusy}><UiIcon name="ios-share" />Export project</button><button type="button" className="secondary-action" onClick={() => { void showWelcome(); }}><UiIcon name="folder-open" />Open another project</button></div>
      <div className="project-actions-footer"><button type="button" className="danger" onClick={() => { void closeProject(); }}>Close project</button></div>
    </div>
  </div>;
}
