import { useCallback, useEffect, useRef, useState } from 'react';
import type { EditorController } from '../app/useEditorWorkspace';

type Toast = { id: number; key: string; text: string; detail?: string; kind: 'error' | 'success' };
const lifetime = 5_000;
const exitDuration = 220;

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: number) => void }) {
  const [exiting, setExiting] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setExiting(true), lifetime);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!exiting) return;
    const timer = window.setTimeout(() => onRemove(toast.id), exitDuration);
    return () => window.clearTimeout(timer);
  }, [exiting, onRemove, toast.id]);
  return <div className={`toast toast-${toast.kind}${exiting ? ' toast-exit' : ''}`} role={toast.kind === 'error' ? 'alert' : 'status'}>
    <div className="toast-copy"><span>{toast.text}</span>{toast.detail && <small>{toast.detail}</small>}</div>
    <button type="button" className="toast-dismiss" aria-label="Dismiss notification" onClick={() => setExiting(true)}>×</button>
  </div>;
}

export function Diagnostics({ editor }: { editor: EditorController }) {
  const { workspace, loading, message, messageId, loadDiagnostics, projectResult, filesPresent, resolutionValid, ready } = editor;
  const [toasts, setToasts] = useState<Toast[]>([]);
  const previous = useRef(new Set<string>());
  const nextId = useRef(0);
  const remove = useCallback((id: number) => setToasts(existing => existing.filter(item => item.id !== id)), []);

  const current: Omit<Toast, 'id'>[] = [];
  if (!loading && message) current.push({ key: `message:${messageId}`, text: message, kind: 'error' });
  for (const diagnostic of loadDiagnostics) current.push({
    key: `load:${diagnostic.path}:${diagnostic.code}:${diagnostic.message}`,
    text: `${diagnostic.target.field === 'backgroundAssetId' ? 'Background image' : diagnostic.target.field || 'Project'}: ${diagnostic.message}`,
    detail: `${diagnostic.path || '/'} · ${diagnostic.target.id ?? 'Project'} · ${diagnostic.code}`,
    kind: 'error',
  });
  if (!loading && workspace) {
    for (const diagnostic of projectResult?.diagnostics ?? []) current.push({
      key: `project:${diagnostic.path}:${diagnostic.code}:${diagnostic.message}`,
      text: `${diagnostic.target.field || 'Project'}: ${diagnostic.message}`,
      detail: diagnostic.path,
      kind: 'error',
    });
    if (!filesPresent) current.push({ key: 'files-missing', text: 'A project image is missing from Assets.', kind: 'error' });
    if (!resolutionValid) current.push({ key: 'resolution-invalid', text: 'Target resolution must be whole numbers from 1 to 8192.', kind: 'error' });
    if (ready) current.push({ key: 'ready', text: 'Project checks passed.', kind: 'success' });
  }
  const fingerprint = JSON.stringify(current);

  useEffect(() => {
    const incoming = JSON.parse(fingerprint) as Omit<Toast, 'id'>[];
    const keys = new Set(incoming.map(item => item.key));
    const fresh = incoming.filter(item => !previous.current.has(item.key)).map(item => ({ ...item, id: ++nextId.current }));
    previous.current = keys;
    if (!fresh.length) return;
    setToasts(existing => [...existing, ...fresh]);
  }, [fingerprint]);

  if (!toasts.length) return null;
  return <div className="toast-stack" aria-label="Notifications">
    {toasts.map(toast => <ToastItem key={toast.id} toast={toast} onRemove={remove} />)}
  </div>;
}
