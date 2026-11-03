import { mountRoom, setPlayerDebugging } from '../../../../packages/runtime/src/index';
import { loadPlayerProject } from '../data/loadPlayerProject';

export async function startPlayer(): Promise<() => void> {
  const stage = document.getElementById('stage');
  const loadingCover = document.getElementById('loading-cover');
  const status = document.getElementById('status');
  const observation = document.getElementById('observation');
  const actionHint = document.getElementById('action-hint');
  const debugWalkPath = document.getElementById('debug-walk-path') as HTMLInputElement | null;
  if (!stage || !loadingCover || !status || !observation || !actionHint || !debugWalkPath) throw new Error('Player shell elements are missing.');
  const showError = (message: string) => {
    loadingCover.classList.add('is-loaded');
    status.classList.remove('sr-only');
    status.setAttribute('role', 'alert');
    status.textContent = message;
  };
  const source = await loadPlayerProject().catch((error: unknown) => {
    showError(error instanceof Error ? error.message : 'Unable to load the sample project.');
    return null;
  });
  if (!source) return () => {};
  if (!source.result.ok) {
    showError(source.result.diagnostics.map(diagnostic => `${diagnostic.message} (${diagnostic.path})`).join('\n'));
    return () => {};
  }
  const dispose = mountRoom({
    project: source.result.project,
    assetUrls: source.assetUrls,
    stage,
    onInspect: text => { observation.textContent = text ?? ''; observation.hidden = !text; },
    onActionHint: text => { actionHint.textContent = text ?? ''; },
    onError: showError,
    onSceneLoaded: () => { loadingCover.classList.add('is-loaded'); status.textContent = 'Game view ready.'; return new Promise<void>(resolve => window.setTimeout(resolve, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220)); },
  });
  const changeDebugging = () => setPlayerDebugging(stage, debugWalkPath.checked);
  debugWalkPath.addEventListener('change', changeDebugging);
  return () => { debugWalkPath.removeEventListener('change', changeDebugging); dispose(); };
}
