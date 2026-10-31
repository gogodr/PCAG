import { useEffect, useState } from 'react';
import { validStateVariableName } from '../../../../../packages/project-format/src/index';
import type { Room, StateValue, StateVariable, StateVariables } from '../../../../../packages/project-format/src/index';
import type { EditorController } from '../../app/useEditorWorkspace';

type Scope = 'scene' | 'game';
type ValueType = 'Boolean' | 'Number' | 'Text';
interface Props { scope: Scope; roomId: string; rooms: Room[]; variables: StateVariables; edit: EditorController['edit']; setMessage: EditorController['setMessage'] }

const valueType = (value: StateValue): ValueType => typeof value === 'boolean' ? 'Boolean' : typeof value === 'number' ? 'Number' : 'Text';
const initialValue = (type: ValueType): StateValue => type === 'Boolean' ? false : type === 'Number' ? 0 : '';

function ValueField({ label, value, change }: { label: string; value: StateValue; change: (value: StateValue) => void }) {
  return typeof value === 'boolean' ? <label>{label}<select aria-label={`Variable ${label.toLowerCase()}`} value={String(value)} onChange={event => change(event.target.value === 'true')}><option value="false">False</option><option value="true">True</option></select></label>
    : <label>{label}<input aria-label={`Variable ${label.toLowerCase()}`} type={typeof value === 'number' ? 'number' : 'text'} step={typeof value === 'number' ? 'any' : undefined} value={value} onChange={event => { if (typeof value === 'string') change(event.target.value); else if (Number.isFinite(event.currentTarget.valueAsNumber)) change(event.currentTarget.valueAsNumber); }} /></label>;
}

function VariableRow({ name, value, rename, change, remove }: {
  name: string; value: StateVariable;
  rename: (name: string) => boolean; change: (value: Partial<StateVariable>) => void; remove: () => void;
}) {
  const [draftName, setDraftName] = useState(name);
  useEffect(() => { setDraftName(name); }, [name]);
  const commitName = () => { if (draftName !== name && !rename(draftName.trim())) setDraftName(name); };
  return <div className="state-variable" role="group" aria-label={`Variable ${name}`}>
    <label>Name<input aria-label="Variable name" value={draftName} onChange={event => setDraftName(event.target.value)} onBlur={commitName} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); else if (event.key === 'Escape') setDraftName(name); }} /></label>
    <label>Type<select aria-label="Variable type" value={valueType(value.defaultValue)} onChange={event => { const next = initialValue(event.target.value as ValueType); change({ value: next, defaultValue: next }); }}>
      <option>Boolean</option><option>Number</option><option>Text</option>
    </select></label>
    <ValueField label="Value" value={value.value} change={next => change({ value: next })} />
    <ValueField label="Default value" value={value.defaultValue} change={next => change({ defaultValue: next })} />
    <button type="button" className="danger" aria-label={`Remove ${name}`} onClick={remove}>Remove</button>
  </div>;
}

export function StateVariablesInspector({ scope, roomId, rooms, variables, edit, setMessage }: Props) {
  const triggerKind = scope === 'game' ? 'game_variable_change' : 'scene_variable_change';
  const update = (change: (current: StateVariables) => void) => edit(next => {
    const current = scope === 'game' ? next.project.gameState : next.project.rooms.find(room => room.id === roomId)?.sceneState;
    if (current) change(current);
  });
  const add = () => {
    let name = 'variable';
    for (let number = 2; Object.hasOwn(variables, name); number++) name = `variable${number}`;
    update(current => { current[name] = { value: false, defaultValue: false }; });
  };
  const rename = (oldName: string, newName: string) => {
    if (!validStateVariableName(newName)) { setMessage('Use a variable name that starts with a letter and contains only letters, numbers, or underscores.'); return false; }
    if (newName !== oldName && Object.hasOwn(variables, newName)) { setMessage(`A variable named ${newName} already exists.`); return false; }
    edit(next => {
      const current = scope === 'game' ? next.project.gameState : next.project.rooms.find(room => room.id === roomId)?.sceneState;
      if (!current) return;
      const entries = Object.entries(current).map(([name, value]) => [name === oldName ? newName : name, value] as const);
      for (const key of Object.keys(current)) delete current[key];
      for (const [name, value] of entries) current[name] = value;
      for (const room of next.project.rooms) {
        if (scope === 'scene' && room.id !== roomId) continue;
        for (const event of room.sceneManager?.events ?? []) for (const trigger of event.triggers) {
          if (trigger.kind === triggerKind && trigger.variableName === oldName) trigger.variableName = newName;
        }
      }
    });
    return true;
  };
  const remove = (name: string) => {
    const referenced = rooms.some(room => (scope === 'game' || room.id === roomId) && room.sceneManager?.events.some(event => event.triggers.some(trigger => trigger.kind === triggerKind && trigger.variableName === name)));
    if (referenced) { setMessage(`Remove the ${scope === 'game' ? 'GameState' : 'SceneState'} event trigger for ${name} before deleting this variable.`); return; }
    update(current => { delete current[name]; });
  };
  return <>
    <h3>{scope === 'game' ? 'GameState' : 'SceneState'}</h3>
    <p className="subtle">{scope === 'game' ? 'These variables are shared by every scene.' : 'These variables belong to this scene.'} Value can be edited here; default value starts a new game.</p>
    <div className="state-variables">
      {Object.entries(variables).map(([name, value]) => <VariableRow key={name} name={name} value={value}
        rename={nextName => rename(name, nextName)}
        change={nextValue => update(current => { current[name] = { ...current[name]!, ...nextValue }; })}
        remove={() => remove(name)} />)}
    </div>
    <button type="button" onClick={add}>Add variable</button>
  </>;
}
