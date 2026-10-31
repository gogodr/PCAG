import type { CSSProperties } from 'react';

type IconName =
  | 'add' | 'add-circle' | 'add-photo-alternate' | 'animation' | 'edit'
  | 'expand-more' | 'filter-list' | 'folder-open' | 'groups' | 'history'
  | 'ios-share' | 'landscape' | 'perm-media' | 'person-add' | 'play-arrow'
  | 'sort' | 'upload-file';

export function UiIcon({ name, className = '' }: { name: IconName; className?: string }) {
  const url = `url("${import.meta.env.BASE_URL}icons/material/${name}.svg")`;
  const style: CSSProperties = { maskImage: url, WebkitMaskImage: url };
  return <span className={`ui-icon ${className}`.trim()} style={style} aria-hidden="true" />;
}
