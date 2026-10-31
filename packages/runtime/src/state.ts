import type { Project, StateValue, StateVariables } from '../../project-format/src/index.ts';

export interface InitialSessionState {
  gameState: Record<string, StateValue>;
  sceneStates: Record<string, Record<string, StateValue>>;
}

/** A new play session starts from defaults, never from creator-edited current values. */
export function createInitialSessionState(project: Project): InitialSessionState {
  const defaults = (variables: StateVariables) => Object.fromEntries(Object.entries(variables).map(([name, variable]) => [name, variable.defaultValue])) as Record<string, StateValue>;
  return {
    gameState: defaults(project.gameState),
    sceneStates: Object.fromEntries(project.rooms.map(room => [room.id, defaults(room.sceneState)])),
  };
}
