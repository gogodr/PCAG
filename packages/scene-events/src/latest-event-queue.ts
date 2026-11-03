/** Each event runs once at a time and retains only its newest pending signal. */
export function createLatestEventQueue<T>(run: (eventId: string, signal: T) => Promise<void>, onError: (eventId: string, error: unknown) => void) {
  const slots = new Map<string, { pending: T | null }>();
  const idleWaiters: Array<() => void> = [];
  const whenIdle = () => slots.size === 0 ? Promise.resolve() : new Promise<void>(resolve => idleWaiters.push(resolve));
  const signal = (eventId: string, value: T) => {
    const active = slots.get(eventId);
    if (active) { active.pending = value; return; }
    const slot: { pending: T | null } = { pending: null };
    slots.set(eventId, slot);
    void (async () => {
      let current = value;
      try {
        while (true) {
          try { await run(eventId, current); }
          catch (error) { onError(eventId, error); }
          if (slot.pending === null) break;
          current = slot.pending;
          slot.pending = null;
        }
      } finally {
        slots.delete(eventId);
        if (slots.size === 0) idleWaiters.splice(0).forEach(resolve => resolve());
      }
    })();
  };
  return { signal, whenIdle };
}
