import { loadSample, sampleAssets } from '../../../../examples/reference-adventure/sample';
import { parseProject } from '../../../../packages/project-format/src/index';
import type { ValidationResult } from '../../../../packages/project-format/src/index';

export interface PlayerProjectSource { result: ValidationResult; assetUrls: ReadonlyMap<string, string> }
export async function loadPlayerProject(): Promise<PlayerProjectSource> {
  const exported = (window as Window & { __PCAG_EXPORT__?: boolean }).__PCAG_EXPORT__ === true;
  if (!exported) return { result: await loadSample(), assetUrls: sampleAssets };
  const response = await fetch('./project.json');
  if (!response.ok) throw new Error(`Unable to load exported project (${response.status}).`);
  const result = parseProject(await response.text());
  return { result, assetUrls: result.ok ? new Map(result.project.assets.map(asset => [asset.path, new URL(asset.path, document.baseURI).href])) : new Map() };
}
