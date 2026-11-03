import type { StateVariables } from '../../../../../packages/project-format/src/index';

function stateFields(variables: StateVariables): string {
  const fields = Object.entries(variables).map(([name, variable]) => {
    const type = typeof variable.defaultValue === 'boolean' ? 'boolean'
      : typeof variable.defaultValue === 'number' ? 'number' : 'string';
    return `  ${JSON.stringify(name)}: ${type};`;
  });
  return [...fields, '  [name: string]: boolean | number | string;'].join('\n');
}

export function scriptEditorTypes(sceneState: StateVariables, gameState: StateVariables): string {
  return `type StateValue = boolean | number | string;
interface TriggerContext {
  action?: string;
  type?: 'scene_variable_change' | 'game_variable_change' | 'character_position';
  x?: number;
  y?: number;
  phase?: 'start' | 'move' | 'end';
  item?: string;
  target?: string;
  old_value?: StateValue;
  value?: StateValue;
}
interface SceneElement {
  /** Play once to its last frame, or start its loop. Resolves when a single run finishes. */
  playAnimation(): Promise<void>;
  /** Stop playback and show its first frame. */
  stopAnimation(): Promise<void>;
  disabled: boolean;
  visible: boolean;
  source: { type: 'IMAGE' | 'ANIMATION' | 'BOX' | 'SHAPE'; uri: string };
  position: { x: number; y: number };
  scale: { width: number; height: number };
  playback: { run: 'LOOP' | 'ONCE'; reverse: boolean };
}
interface SceneContext {
  state: {
${stateFields(sceneState)}
  };
  elements: Record<string, SceneElement>;
}
interface GameContext {
  state: {
${stateFields(gameState)}
  };
}`;
}
