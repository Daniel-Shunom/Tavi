// Bounded, source-tagged conversation memory. Short-lived: nothing is persisted.
import type { ContextEvent } from './types.js';

export class ConversationContext {
  private events: ContextEvent[] = [];
  constructor(
    private readonly limit = 10,
    private readonly maxAgeMs = 5 * 60_000,
    private readonly maxChars = 1800,
  ) {}
  add(event: ContextEvent) {
    this.events.push({ ...event, text: event.text.slice(0, 280) });
    this.trim(event.at);
  }
  /** Moderation: forget a deleted chat message. */
  remove(id: string) {
    this.events = this.events.filter((event) => event.id !== id);
  }
  removeSource(source: ContextEvent['source']) {
    this.events = this.events.filter((event) => event.source !== source);
  }
  recent(now: number): ContextEvent[] {
    this.trim(now);
    return [...this.events];
  }
  clear() {
    this.events = [];
  }
  private trim(now: number) {
    this.events = this.events.filter((event) => now - event.at <= this.maxAgeMs).slice(-this.limit);
    let total = 0;
    const kept: ContextEvent[] = [];
    for (const event of [...this.events].reverse()) {
      total += event.text.length;
      if (total > this.maxChars && kept.length) break;
      kept.unshift(event);
    }
    this.events = kept;
  }
}
