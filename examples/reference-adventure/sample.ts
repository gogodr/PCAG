import projectUrl from './project.json?url&no-inline';
import { parseProject } from '../../packages/project-format/src/index';

/** Development fixture adapter, not project import/storage or playable export. */
export async function loadSample() {
  const response = await fetch(projectUrl);
  if (!response.ok) throw new Error(`Unable to load the sample project (${response.status}).`);
  return parseProject(await response.text());
}

const bundled = {
  ...import.meta.glob('./backgrounds/**/*.png', { query: '?url&no-inline', import: 'default', eager: true }),
  ...import.meta.glob('./images/**/*.png', { query: '?url&no-inline', import: 'default', eager: true }),
} as Record<string, string>;
export const sampleAssets: ReadonlyMap<string, string> = new Map(Object.entries(bundled).map(([path, url]) => [path.slice(2), url]));
