interface ScriptRequest { id: number; name: string; script: string; scene: { elements: Record<string, Record<string, unknown>> }; game: unknown; trigger: unknown }
interface AnimationResult { type: 'animation_result'; id: number; commandId: number; error?: string }

let nextCommandId = 0;
const pending = new Map<number, { resolve: () => void; reject: (error: Error) => void }>();

self.onmessage = async (message: MessageEvent<ScriptRequest | AnimationResult>) => {
  const payload = message.data;
  if ('type' in payload) {
    const command = pending.get(payload.commandId);
    if (!command) return;
    pending.delete(payload.commandId);
    if (payload.error) command.reject(new Error(payload.error));
    else command.resolve();
    return;
  }
  const { id, name, script, scene, game, trigger } = payload;
  const elementIds = new Map<Record<string, unknown>, string>();
  for (const [key, element] of Object.entries(scene.elements)) if (!elementIds.has(element)) elementIds.set(element, key);
  const command = (elementId: string, action: 'play' | 'stop') => new Promise<void>((resolve, reject) => {
    const commandId = ++nextCommandId;
    pending.set(commandId, { resolve, reject });
    self.postMessage({ type: 'animation_command', id, commandId, elementId, action, elements: scene.elements });
  });
  for (const [element, elementId] of elementIds) {
    Object.defineProperty(element, 'playAnimation', { configurable: true, value: () => command(elementId, 'play') });
    Object.defineProperty(element, 'stopAnimation', { configurable: true, value: () => command(elementId, 'stop') });
  }
  let errorMessage: string | null = null;
  try {
    // The function name is generated from a validated event ID by the host.
    const run = new Function('scene', 'game', 'trigger', `"use strict";\n${script}\nif (typeof ${name} !== "function") throw new Error("Expected function ${name}.");\nreturn ${name}(scene, game, trigger);`);
    await run(scene, game, trigger);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Script failed.';
  } finally {
    for (const element of elementIds.keys()) { delete element.playAnimation; delete element.stopAnimation; }
  }
  if (errorMessage) self.postMessage({ id, error: errorMessage });
  else self.postMessage({ id, scene, game });
};
