// Per-conversation message queue (guardrail 00 §6): concurrent inbound
// messages for the same lead are serialized; two messages for one lead
// never race through the engine.

const chains = new Map<string, Promise<void>>();

export function enqueueForLead(key: string, task: () => Promise<void>): Promise<void> {
  const prev = chains.get(key) ?? Promise.resolve();
  const next = prev.then(task, task);
  chains.set(key, next);
  void next.finally(() => {
    if (chains.get(key) === next) chains.delete(key);
  });
  return next;
}
