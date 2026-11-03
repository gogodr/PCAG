/** Decode authored GIFs into Phaser frames so directional walk animations play inside the scene layer. */
export async function characterFrames(url: string): Promise<{ frames: string[]; fps: number }> {
  if (!url.startsWith('data:image/gif')) return { frames: [url], fps: 8 };
  const Decoder = (globalThis as unknown as { ImageDecoder?: new (options: { data: Uint8Array; type: string }) => {
    tracks: { ready: Promise<void>; selectedTrack: { frameCount: number } };
    decode: (options: { frameIndex: number }) => Promise<{ image: { displayWidth: number; displayHeight: number; duration?: number; close: () => void } }>;
    close: () => void;
  } }).ImageDecoder;
  if (!Decoder) return { frames: [url], fps: 8 };
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  const decoder = new Decoder({ data: bytes, type: 'image/gif' });
  try {
    await decoder.tracks.ready;
    const count = Math.min(decoder.tracks.selectedTrack.frameCount, 240);
    const frames: string[] = [];
    let duration = 0;
    for (let index = 0; index < count; index++) {
      const { image } = await decoder.decode({ frameIndex: index });
      const canvas = document.createElement('canvas');
      canvas.width = image.displayWidth; canvas.height = image.displayHeight;
      canvas.getContext('2d')!.drawImage(image as unknown as CanvasImageSource, 0, 0);
      frames.push(canvas.toDataURL('image/png'));
      duration += image.duration ?? 125_000;
      image.close();
    }
    return { frames, fps: Math.max(1, Math.min(60, count * 1_000_000 / duration)) };
  } finally { decoder.close(); }
}
