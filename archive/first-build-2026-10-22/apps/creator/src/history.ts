import type { Project } from '../../../packages/project-format/src/index';

export interface History { past: Project[]; present: Project; future: Project[] }
export type EditAction = { type: 'edit'; update: (project: Project) => void } | { type: 'replace'; project: Project } | { type: 'undo' } | { type: 'redo' };

export function historyReducer(state: History, action: EditAction): History {
  if (action.type === 'replace') return { past: [], present: action.project, future: [] };
  if (action.type === 'undo') {
    if (!state.past.length) return state;
    return { past: state.past.slice(0, -1), present: state.past.at(-1)!, future: [state.present, ...state.future] };
  }
  if (action.type === 'redo') {
    if (!state.future.length) return state;
    return { past: [...state.past, state.present], present: state.future[0], future: state.future.slice(1) };
  }
  const next = structuredClone(state.present);
  action.update(next);
  if (JSON.stringify(next) === JSON.stringify(state.present)) return state;
  return { past: [...state.past.slice(-39), state.present], present: next, future: [] };
}
