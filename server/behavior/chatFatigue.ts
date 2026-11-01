import { hash01 } from '../../shared/states.js';

/** Prevents busy-chat peeks from repeating mechanically during raid-like spam bursts. */
export class ChatBurstFatigue {
  private active = false;
  private handled = false;
  private visitsSinceBreak = 0;
  private ignoredBursts = 0;

  update(burstActive: boolean) {
    if (!burstActive) {
      this.active = false;
      this.handled = false;
      return;
    }
    if (!this.active) {
      this.active = true;
      this.handled = false;
    }
  }

  /** Called once when a burst is otherwise eligible to trigger a chat visit. */
  ignoreThisBurst(seed: string) {
    if (this.handled) return false;
    this.handled = true;
    if (this.ignoredBursts > 0) {
      this.ignoredBursts--;
      return true;
    }
    this.visitsSinceBreak++;
    if (this.visitsSinceBreak >= 2) {
      this.visitsSinceBreak = 0;
      this.ignoredBursts = 5 + Math.floor(hash01(`chat-fatigue:${seed}`) * 6);
    }
    return false;
  }
}
