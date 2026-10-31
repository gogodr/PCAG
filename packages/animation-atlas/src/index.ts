export interface AtlasFrame { rect: { x: number; y: number; width: number; height: number } }
export interface AnimationAtlas { image: string; gif: string; fps: number; frameWidth: number; frameHeight: number; frames: AtlasFrame[] }

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const positiveInteger = (value: unknown): value is number => Number.isSafeInteger(value) && typeof value === 'number' && value > 0;
const filename = (value: unknown, extension: string): value is string => typeof value === 'string' && /^[A-Za-z0-9_-][A-Za-z0-9_. ()-]*$/i.test(value) && value.toLowerCase().endsWith(extension);

export function parseAnimationAtlas(value: unknown): AnimationAtlas | null {
  if (!record(value) || value.format !== 'pcag-animation-atlas' || !filename(value.image, '.png') || !filename(value.gif, '.gif') || !positiveInteger(value.fps) || value.fps > 60 || !positiveInteger(value.frameWidth) || !positiveInteger(value.frameHeight) || !Array.isArray(value.frames) || value.frames.length < 1 || value.frames.length > 1000) return null;
  for (const [index, frame] of value.frames.entries()) {
    if (!record(frame) || !record(frame.rect) || frame.rect.x !== index * value.frameWidth || frame.rect.y !== 0 || frame.rect.width !== value.frameWidth || frame.rect.height !== value.frameHeight) return null;
  }
  return { image: value.image, gif: value.gif, fps: value.fps, frameWidth: value.frameWidth, frameHeight: value.frameHeight, frames: value.frames as AtlasFrame[] };
}

export function animationAtlasFromDataUrl(dataUrl: string | undefined): AnimationAtlas | null {
  if (!dataUrl) return null;
  try {
    const bytes = Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(',') + 1)), character => character.charCodeAt(0));
    return parseAnimationAtlas(JSON.parse(new TextDecoder().decode(bytes)));
  } catch { return null; }
}
