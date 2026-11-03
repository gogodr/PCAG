import type { Project } from '../../../../packages/project-format/src/index';

export interface ScenePlaySnapshot { project: Project; urls: ReadonlyMap<string, string> }
export type ScenePlayMessage = { type: 'scene-play-ready'; token: string } | { type: 'scene-play-start'; token: string; snapshot: ScenePlaySnapshot };

export function openScenePlayWindow(snapshot: ScenePlaySnapshot, onError: (message: string) => void): void {
  const token = crypto.randomUUID();
  const url = new URL(window.location.href);
  url.search = new URLSearchParams({ 'scene-play': token }).toString();
  url.hash = '';
  const popup = window.open(url.href, '_blank', 'popup,width=1120,height=760');
  if (!popup) { onError('The scene window could not open. Allow popups for this app and try again.'); return; }
  const receive = (event: MessageEvent<ScenePlayMessage>) => {
    if (event.source !== popup || event.data?.type !== 'scene-play-ready' || event.data.token !== token) return;
    window.clearTimeout(timeout);
    window.removeEventListener('message', receive);
    popup.postMessage({ type: 'scene-play-start', token, snapshot } satisfies ScenePlayMessage, '*');
  };
  const timeout = window.setTimeout(() => {
    window.removeEventListener('message', receive);
    if (!popup.closed) onError('The scene window did not become ready. Close it and try again.');
  }, 15_000);
  window.addEventListener('message', receive);
}
