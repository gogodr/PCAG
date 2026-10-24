import type { Page } from '@playwright/test';

export async function installFolderPicker(page: Page, names: string[]): Promise<void> {
  const key = `pcag-picker-${crypto.randomUUID()}`;
  await page.addInitScript(({ key, names }) => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: async () => {
        const index = Number(sessionStorage.getItem(key) ?? '0');
        sessionStorage.setItem(key, String(index + 1));
        const root = await navigator.storage.getDirectory();
        return root.getDirectoryHandle(names[Math.min(index, names.length - 1)]!, { create: true });
      },
    });
  }, { key, names });
}

export async function readProjectFile(page: Page, folder: string, path: string): Promise<Uint8Array> {
  return page.evaluate(async ({ folder, path }) => {
    let directory = await (await navigator.storage.getDirectory()).getDirectoryHandle(folder);
    const names = path.split('/');
    const name = names.pop()!;
    for (const segment of names) directory = await directory.getDirectoryHandle(segment);
    return [...new Uint8Array(await (await (await directory.getFileHandle(name)).getFile()).arrayBuffer())];
  }, { folder, path }).then(bytes => Uint8Array.from(bytes));
}
