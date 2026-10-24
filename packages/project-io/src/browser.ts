import type { Project } from '../../project-format/src/index';
import type { Workspace } from '../../editor-workspace/src/index';
import { createZip } from './zip';
import type { ZipEntry } from './zip';
import { encodeWorkspace } from './workspace-archive';

const encoder = new TextEncoder();
const json = (project: Project) => encoder.encode(`${JSON.stringify(project, null, 2)}\n`);

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function exportWorkspace(workspace: Workspace): Promise<void> {
  const archive = await encodeWorkspace(workspace);
  download(new Blob([archive.slice().buffer], { type: 'application/octet-stream' }), 'project.pcag');
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to fetch export file ${url} (${response.status}).`);
  return new Uint8Array(await response.arrayBuffer());
}

export async function exportPlayer(project: Project, assetUrls: ReadonlyMap<string, string>): Promise<void> {
  const desktop = (window as Window & { pcagDesktop?: { invoke<T>(channel: string): Promise<T> } }).pcagDesktop;
  const bundled = desktop ? await desktop.invoke<Array<{ path: string; data: string }>>('player-template') : null;
  const manifest = bundled ? { files: bundled.map(file => file.path) } : await (async () => {
    const response = await fetch(new URL('./player-template/manifest.json', document.baseURI));
    if (!response.ok) throw new Error('The player export template is missing. Rebuild the player template.');
    return response.json() as Promise<{ files?: unknown }>;
  })();
  if (!Array.isArray(manifest.files) || !manifest.files.every(path => typeof path === 'string')) throw new Error('The player export template manifest is invalid.');
  const entries: ZipEntry[] = [];
  for (const path of manifest.files as string[]) {
    if (path === 'manifest.json' || path.startsWith('assets/project-')) continue;
    const local = bundled?.find(file => file.path === path);
    const bytes = local ? Uint8Array.from(atob(local.data), character => character.charCodeAt(0)) : await fetchBytes(new URL(`./player-template/${path}`, document.baseURI).href);
    if (path === 'index.html') {
      const html = new TextDecoder().decode(bytes);
      if (!html.includes('</head>')) throw new Error('The player export template has no document head.');
      entries.push({ path, data: encoder.encode(html.replace('</head>', '<script>window.__PCAG_EXPORT__=true</script></head>')) });
    } else entries.push({ path, data: bytes });
  }
  for (const asset of project.assets) if (!assetUrls.has(asset.path)) throw new Error(`Image file for "${asset.path}" is unavailable.`);
  for (const [path, url] of assetUrls) {
    entries.push({ path, data: await fetchBytes(url) });
  }
  entries.push({ path: 'project.json', data: json(project) });
  download(createZip(entries), 'pcag-player.zip');
}
