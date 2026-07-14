// Tiny typed event emitter — used for store changes.

type Handler<T = unknown> = (payload: T) => void;

export class Emitter<EventMap extends Record<string, unknown> = Record<string, unknown>> {
  private handlers: { [K in keyof EventMap]?: Set<Handler<EventMap[K]>> } = {};

  on<K extends keyof EventMap>(event: K, handler: Handler<EventMap[K]>): () => void {
    if (!this.handlers[event]) this.handlers[event] = new Set();
    this.handlers[event]!.add(handler);
    return () => this.off(event, handler);
  }

  off<K extends keyof EventMap>(event: K, handler: Handler<EventMap[K]>): void {
    this.handlers[event]?.delete(handler);
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    this.handlers[event]?.forEach(h => h(payload));
  }
}
