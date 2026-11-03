import { useEffect, useRef, useState } from 'react';
import type { Project } from '../../../../packages/project-format/src/index';
import { mountRoom, setPlayerDebugging } from '../../../../packages/runtime/src/index';

interface Props { project: Project; urls: ReadonlyMap<string, string>; onClose: () => void }
export function Preview({ project, urls, onClose }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const [observation, setObservation] = useState<string | null>(null);
  const [actionHint, setActionHint] = useState<string | null>(null);
  const [status, setStatus] = useState('Loading game view...');
  const [sceneLoaded, setSceneLoaded] = useState(false);
  const [debugging, setDebugging] = useState(false);
  useEffect(() => {
    if (!stage.current) return;
    setSceneLoaded(false);
    setStatus('Loading game view...');
    return mountRoom({ project, assetUrls: urls, stage: stage.current, onInspect: setObservation, onActionHint: setActionHint, onError: message => { setStatus(message); setSceneLoaded(true); }, onSceneLoaded: () => { setSceneLoaded(true); setStatus('Game view ready.'); return new Promise<void>(resolve => window.setTimeout(resolve, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220)); } });
  }, [project, urls]);
  return <section className="preview" aria-label="Adventure preview">
    <div className="preview-bar"><h2>Preview</h2><span role="status">{status}</span><label className="preview-debug-toggle"><input type="checkbox" aria-label="Debug walk path" checked={debugging} onChange={event => { const enabled = event.currentTarget.checked; setDebugging(enabled); if (stage.current) setPlayerDebugging(stage.current, enabled); }} />Debug walk path</label><button type="button" onClick={onClose}>Close preview</button></div>
    <div className="preview-stage-shell"><div className="preview-stage" ref={stage} aria-label="Room preview" /><div className={`preview-loading-cover${sceneLoaded ? ' is-loaded' : ''}`} aria-hidden="true" /></div>
    <p className="action-hint" role="status">{actionHint ?? ''}</p>
    <p className="observation" role="status">{observation ?? 'Click an element to inspect it.'}</p>
  </section>;
}
