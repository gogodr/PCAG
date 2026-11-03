import { lazy, Suspense, useEffect, useState } from 'react';
import type { ScenePlayMessage, ScenePlaySnapshot } from './scenePlayBridge';

const Preview = lazy(() => import('../components/Preview').then(module => ({ default: module.Preview })));

export function ScenePlayWindow() {
  const token = new URLSearchParams(window.location.search).get('scene-play');
  const [snapshot, setSnapshot] = useState<ScenePlaySnapshot | null>(null);
  useEffect(() => {
    if (!token) return;
    const receive = (event: MessageEvent<ScenePlayMessage>) => {
      if (event.source !== window.opener || event.data?.type !== 'scene-play-start' || event.data.token !== token) return;
      const next = event.data.snapshot;
      setSnapshot(current => current ?? next);
    };
    window.addEventListener('message', receive);
    window.opener?.postMessage({ type: 'scene-play-ready', token } satisfies ScenePlayMessage, '*');
    return () => window.removeEventListener('message', receive);
  }, [token]);
  useEffect(() => { if (snapshot) document.title = `${snapshot.project.rooms.find(room => room.id === snapshot.project.startRoomId)?.name ?? 'Scene'} — Play scene`; }, [snapshot]);
  return <main className="scene-play-window">
    {snapshot ? <Suspense fallback={<p role="status">Opening scene…</p>}><Preview project={snapshot.project} urls={snapshot.urls} onClose={() => window.close()} /></Suspense> : <p role="status">Opening scene…</p>}
  </main>;
}
