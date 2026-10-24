import { mountRoom } from '../../../../packages/runtime/src/index';
import { loadPlayerProject } from '../data/loadPlayerProject';

export async function startPlayer(): Promise<() => void> {
  const stage = document.getElementById('stage');
  const status = document.getElementById('status');
  const observation = document.getElementById('observation');
  if (!stage || !status || !observation) throw new Error('Player shell elements are missing.');
  const showError = (message: string) => {
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
  return mountRoom({
    project: source.result.project,
    assetUrls: source.assetUrls,
    stage,
    onInspect: text => { observation.textContent = text ?? ''; observation.hidden = !text; },
    onError: showError,
    onReady: () => { status.textContent = 'Game view ready.'; },
  });
}
