import type { Scene } from '../../shared/states.js';
import type { Initiative, Personality } from '../../shared/states.js';
import { anchorPoint } from '../../shared/attention.js';
import { bounds, type AnchorId, type Point } from '../../shared/locomotion.js';

export interface RoamVisit {
  to: Point;
  anchor?: AnchorId;
  target: 'chat' | 'streamer' | 'game' | 'neutral';
  expression: 'wave' | 'glance' | 'excited' | 'teasing';
}

export interface RoamPersona {
  initiative: Initiative;
  personality: Personality;
  energy: number;
  chatEngagement: number;
}

/** Bounded deterministic schedule for visible, autonomous idle travel. */
export class RoamDirector {
  private nextAt: number;
  private visit = 0;

  constructor(now: number) {
    this.nextAt = now + 12_000;
  }

  private interval(persona: RoamPersona) {
    const initiative = { reserved: 0, occasional: 0.68, outgoing: 1 }[persona.initiative];
    const personality = { cozy: 0.62, playful: 1, shy: 0.4 }[persona.personality];
    const energy = 0.5 + Math.max(0, Math.min(100, persona.energy)) / 200;
    const drive = (persona.chatEngagement / 100) * initiative * personality * energy;
    return 30_000 + 180_000 * (1 - Math.min(1, drive));
  }

  /** Select an enabled scene region when the configured interaction level is active. */
  tick(input: {
    now: number;
    persona: RoamPersona;
    home: Point;
    scene: Scene;
    quiet: boolean;
    retracted: boolean;
    busy: boolean;
    asleep: boolean;
    manualHold: boolean;
    movementActive: boolean;
  }): RoamVisit | null {
    if (input.persona.initiative === 'reserved' || input.persona.chatEngagement < 25) return null;
    if (input.now < this.nextAt) return null;
    this.nextAt = input.now + this.interval(input.persona);
    if (
      input.quiet ||
      input.retracted ||
      input.busy ||
      input.asleep ||
      input.manualHold ||
      input.movementActive
    )
      return null;

    const visits: RoamVisit[] = [];
    if (input.scene.chat.enabled)
      visits.push({
        to: anchorPoint('chat', input.scene),
        anchor: 'chat',
        target: 'chat',
        expression: 'wave',
      });
    if (input.scene.webcam.enabled)
      visits.push({
        to: anchorPoint('webcam', input.scene),
        anchor: 'webcam',
        target: 'streamer',
        expression: 'glance',
      });
    if (input.scene.game.enabled)
      visits.push({
        to: {
          x: Math.min(
            bounds.maxX,
            Math.max(bounds.minX, input.scene.game.x + input.scene.game.w / 2),
          ),
          y: Math.min(
            bounds.maxY,
            Math.max(bounds.minY, input.scene.game.y + input.scene.game.h + 0.05),
          ),
        },
        target: 'game',
        expression: 'excited',
      });
    visits.push({
      to: {
        x: input.home.x < 0.5 ? bounds.maxX - 0.02 : bounds.minX + 0.02,
        y: input.home.y,
      },
      anchor: 'corner',
      target: 'neutral',
      expression: 'teasing',
    });
    const candidates = visits.filter((visit) => Math.abs(visit.to.x - input.home.x) >= 0.22);
    if (!candidates.length) return null;
    const choice = candidates[this.visit % candidates.length] ?? candidates[0];
    this.visit++;
    return choice ?? null;
  }
}
