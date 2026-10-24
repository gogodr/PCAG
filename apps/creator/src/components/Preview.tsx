import { useEffect, useRef, useState } from 'react';
import type { Project } from '../../../../packages/project-format/src/index';
import { mountRoom } from '../../../../packages/runtime/src/index';

interface Props { project: Project; urls: ReadonlyMap<string, string>; onClose: () => void }
export function Preview({ project, urls, onClose }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const [observation, setObservation] = useState<string | null>(null);
  const [status, setStatus] = useState('Loading game view...');
  useEffect(() => {
    if (!stage.current) return;
    return mountRoom({ project, assetUrls: urls, stage: stage.current, onInspect: setObservation, onError: setStatus, onReady: () => setStatus('Game view ready.') });
  }, [project, urls]);
  return <section className="preview" aria-label="Adventure preview">
    <div className="preview-bar"><h2>Preview</h2><span role="status">{status}</span><button type="button" onClick={onClose}>Close preview</button></div>
    <div className="preview-stage" ref={stage} aria-label="Room preview" />
    <p className="observation" role="status">{observation ?? 'Click a hotspot to inspect it.'}</p>
  </section>;
}
