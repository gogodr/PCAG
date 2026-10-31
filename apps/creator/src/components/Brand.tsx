export function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={`pcag-brand${compact ? ' pcag-brand-compact' : ''}`}>
    <span className="pcag-brand-mark" aria-hidden="true"><span /></span>
    <span className="pcag-brand-type"><strong>PCAG</strong><small>ADVENTURE STUDIO</small></span>
  </div>;
}
