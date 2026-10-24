interface DesktopBridge {
  invoke<T>(channel: string, ...args: unknown[]): Promise<T>;
}

declare global { interface Window { pcagDesktop?: DesktopBridge } }

const bridge = () => {
  if (!window.pcagDesktop) throw new Error('Desktop file bridge is unavailable.');
  return window.pcagDesktop;
};
const missing = () => new DOMException('File or folder does not exist.', 'NotFoundError');
const childPath = (parent: string, name: string) => {
  if (!name || name === '.' || name === '..' || name.includes('/') || name.includes('\\')) throw new TypeError('Invalid file or folder name.');
  return parent ? `${parent}/${name}` : name;
};

class DesktopFileHandle {
  readonly kind = 'file' as const;
  constructor(readonly root: string, readonly path: string, readonly name: string) {}
  async getFile(): Promise<File> {
    if (await bridge().invoke('exists', this.root, this.path) !== 'file') throw missing();
    const bytes = await bridge().invoke<number[]>('read', this.root, this.path);
    return new File([new Uint8Array(bytes)], this.name);
  }
  async createWritable(): Promise<FileSystemWritableFileStream> {
    let bytes: Uint8Array | null = null;
    const result = {
      write: async (data: FileSystemWriteChunkType) => {
        if (data instanceof ArrayBuffer) bytes = new Uint8Array(data);
        else if (data instanceof Blob) bytes = new Uint8Array(await data.arrayBuffer());
        else if (typeof data === 'string') bytes = new TextEncoder().encode(data);
        else throw new TypeError('Unsupported write payload.');
      },
      close: async () => {
        if (bytes === null) throw new Error('No data was written.');
        await bridge().invoke('write', this.root, this.path, Array.from(bytes));
      },
    };
    return result as FileSystemWritableFileStream;
  }
}

class DesktopDirectoryHandle {
  readonly kind = 'directory' as const;
  constructor(readonly root: string, readonly path: string, readonly name: string) {}
  async getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle> {
    const path = childPath(this.path, name);
    const kind = await bridge().invoke<string | null>('exists', this.root, path);
    if (!kind && options?.create) await bridge().invoke('mkdir', this.root, path);
    else if (kind !== 'directory') throw missing();
    return new DesktopDirectoryHandle(this.root, path, name) as unknown as FileSystemDirectoryHandle;
  }
  async getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle> {
    const path = childPath(this.path, name);
    const kind = await bridge().invoke<string | null>('exists', this.root, path);
    if (!kind && !options?.create) throw missing();
    if (kind && kind !== 'file') throw missing();
    return new DesktopFileHandle(this.root, path, name) as unknown as FileSystemFileHandle;
  }
  async removeEntry(name: string): Promise<void> {
    await bridge().invoke('remove', this.root, childPath(this.path, name));
  }
  async *values(): AsyncIterable<FileSystemHandle> {
    const entries = await bridge().invoke<Array<{ name: string; kind: string }>>('entries', this.root, this.path);
    for (const entry of entries) {
      const path = childPath(this.path, entry.name);
      yield (entry.kind === 'directory' ? new DesktopDirectoryHandle(this.root, path, entry.name) : new DesktopFileHandle(this.root, path, entry.name)) as unknown as FileSystemHandle;
    }
  }
}

export function desktopHandle(selected: { root: string; name: string }): FileSystemDirectoryHandle {
  return new DesktopDirectoryHandle(selected.root, '', selected.name) as unknown as FileSystemDirectoryHandle;
}

export function desktopRoot(handle: FileSystemDirectoryHandle): string {
  return (handle as unknown as DesktopDirectoryHandle).root;
}
