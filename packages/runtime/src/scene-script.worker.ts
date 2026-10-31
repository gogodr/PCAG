interface ScriptRequest { id: number; name: string; script: string; scene: unknown; game: unknown; trigger: unknown }

self.onmessage = (message: MessageEvent<ScriptRequest>) => {
  const { id, name, script, scene, game, trigger } = message.data;
  try {
    // The function name is generated from a validated event ID by the host.
    const run = new Function('scene', 'game', 'trigger', `"use strict";\n${script}\nif (typeof ${name} !== "function") throw new Error("Expected function ${name}.");\nreturn ${name}(scene, game, trigger);`);
    const result: unknown = run(scene, game, trigger);
    if (result && typeof (result as Promise<unknown>).then === 'function') throw new Error('Event scripts must finish synchronously.');
    self.postMessage({ id, scene, game });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : 'Script failed.' });
  }
};
