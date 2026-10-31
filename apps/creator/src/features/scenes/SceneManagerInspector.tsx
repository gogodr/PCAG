import { lazy, Suspense, useState } from 'react';
import type { Room, SceneEvent, SceneTrigger, StateVariables } from '../../../../../packages/project-format/src/index';
import { createId, playerActions } from '../../../../../packages/project-format/src/index';
import { initialEventScript, playerActionLabels } from '../../../../../packages/scene-events/src/index';
import type { EditorController } from '../../app/useEditorWorkspace';

const ScriptEditorDialog = lazy(() => import('./ScriptEditorDialog'));
const baseTriggers = [
  ['game_load', 'Game Load'], ['game_close', 'Game Close'], ['scene_load', 'Scene Load'], ['scene_close', 'Scene Close'],
] as const;

interface Props { room: Room; gameState: StateVariables; edit: EditorController['edit'] }

export function SceneManagerInspector({ room, gameState, edit }: Props) {
  const [scriptId, setScriptId] = useState<string | null>(null);
  const events = room.sceneManager?.events ?? [];
  const scriptEvent = events.find(event => event.id === scriptId);
  const update = (change: (events: SceneEvent[]) => void) => edit(next => {
    const selected = next.project.rooms.find(scene => scene.id === room.id);
    if (!selected) return;
    selected.sceneManager ??= { events: [] };
    change(selected.sceneManager.events);
  });
  const updateEvent = (id: string, change: (event: SceneEvent) => void) => update(next => {
    const event = next.find(item => item.id === id);
    if (event) change(event);
  });
  const addEvent = () => {
    const id = createId();
    update(next => next.push({ id, name: `Event ${next.length + 1}`, triggers: [{ kind: 'scene_load' }], script: initialEventScript(id) }));
  };
  const changeTrigger = (eventId: string, index: number, trigger: SceneTrigger) => updateEvent(eventId, event => { event.triggers[index] = trigger; });
  const triggerForKind = (kind: SceneTrigger['kind']): SceneTrigger => {
    if (kind === 'player_action') return { kind, action: 'view', targetId: room.elements[0]?.id ?? '' };
    if (kind === 'scene_variable_change') return { kind, variableName: Object.keys(room.sceneState)[0] ?? '' };
    if (kind === 'game_variable_change') return { kind, variableName: Object.keys(gameState)[0] ?? '' };
    return { kind };
  };

  return <div className="scene-manager-inspector">
    <div className="scene-manager-heading"><div><h3>SceneManager</h3><p className="subtle">Any matching trigger runs its event script once.</p></div><button type="button" onClick={addEvent}>Add Event</button></div>
    {events.length === 0 && <p className="subtle">Add an event to respond to scene lifecycle, state changes, or player actions.</p>}
    {events.map(event => <section key={event.id} className="scene-event-card" aria-label={`Event ${event.name}`}>
      <div className="scene-event-heading"><label>Name<input aria-label="Event name" value={event.name} onChange={change => { const name = change.currentTarget.value; updateEvent(event.id, item => { item.name = name; }); }} /></label><button type="button" className="danger" aria-label={`Remove ${event.name}`} onClick={() => update(next => { const index = next.findIndex(item => item.id === event.id); if (index >= 0) next.splice(index, 1); })}>Remove Event</button></div>
      <div className="scene-trigger-heading"><strong>Triggers <span>(OR)</span></strong><button type="button" onClick={() => updateEvent(event.id, item => { item.triggers.push({ kind: 'scene_load' }); })}>Add Trigger</button></div>
      {event.triggers.map((trigger, index) => <div key={index} className="scene-trigger-row" aria-label={`Trigger ${index + 1}`}>
        <select aria-label="Trigger type" value={trigger.kind} onChange={change => changeTrigger(event.id, index, triggerForKind(change.currentTarget.value as SceneTrigger['kind']))}>
          {baseTriggers.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          <option value="scene_variable_change">SceneState variable change</option><option value="game_variable_change">GameState variable change</option><option value="player_action">Player Action</option>
        </select>
        {(trigger.kind === 'scene_variable_change' || trigger.kind === 'game_variable_change') && <select aria-label="State variable" value={trigger.variableName} onChange={change => changeTrigger(event.id, index, { ...trigger, variableName: change.currentTarget.value })}>
          <option value="">Choose variable</option>{Object.keys(trigger.kind === 'scene_variable_change' ? room.sceneState : gameState).map(name => <option key={name} value={name}>{name}</option>)}
        </select>}
        {trigger.kind === 'player_action' && <><select aria-label="Player action" value={trigger.action} onChange={change => changeTrigger(event.id, index, { ...trigger, action: change.currentTarget.value as typeof trigger.action })}>{playerActions.map(action => <option key={action} value={action}>{playerActionLabels[action]}</option>)}</select>
          <select aria-label="Action target" value={trigger.targetId} onChange={change => changeTrigger(event.id, index, { ...trigger, targetId: change.currentTarget.value })}><option value="">Choose element</option>{room.elements.map(element => <option key={element.id} value={element.id}>{element.name} ({element.id})</option>)}</select>
          {(trigger.action === 'use' || trigger.action === 'give') && <input aria-label="Action item ID" placeholder="Item ID (optional)" value={trigger.itemId ?? ''} onChange={change => { const itemId = change.currentTarget.value; changeTrigger(event.id, index, { ...trigger, itemId }); }} />}</>}
        <button type="button" className="scene-trigger-remove" aria-label={`Remove trigger ${index + 1}`} disabled={event.triggers.length === 1} onClick={() => updateEvent(event.id, item => { item.triggers.splice(index, 1); })}>×</button>
      </div>)}
      <div className="scene-event-actions"><code>{event.id}</code><button type="button" onClick={() => setScriptId(event.id)}>Edit Script</button></div>
    </section>)}
    {scriptEvent && <Suspense fallback={<div className="scene-script-backdrop"><div role="status">Loading script editor…</div></div>}><ScriptEditorDialog key={scriptEvent.id} event={scriptEvent} sceneState={room.sceneState} gameState={gameState} elements={room.elements} onClose={() => setScriptId(null)} onSave={script => { updateEvent(scriptEvent.id, item => { item.script = script; }); setScriptId(null); }} /></Suspense>}
  </div>;
}
