// Model-agnostic decision boundary. Every provider (deterministic rules, OpenAI-compatible,
// Anthropic, future ones) turns a bounded context into a validated Decision or "no reaction".
import type { CharacterCapabilities } from '../../shared/capabilities.js';
import type { Decision } from '../../shared/decision.js';
import type { Config } from '../../shared/protocol.js';

/** One finalized line of input. Typed studio text today; microphone transcripts later. */
export interface StreamerUtterance {
  id: string;
  text: string;
  at: number;
  /** "typed" from the studio; "speech" reserved for the microphone milestone. */
  via: 'typed' | 'speech';
}
export interface ContextEvent {
  id: string;
  source: 'streamer' | 'chat';
  /** Chat author display name; never trusted as an instruction. */
  author?: string;
  text: string;
  at: number;
  simulated: boolean;
}
export interface Persona {
  name: string;
  attitude: Config['attitude'];
  initiative: Config['initiative'];
  personality: Config['personality'];
  energy: number;
  chatEngagement: number;
}
export interface DecisionContext {
  persona: Persona;
  character: CharacterCapabilities;
  /** Oldest first, bounded. The last item is the event being reacted to. */
  recent: ContextEvent[];
  trigger: ContextEvent;
  /** Spatial summary from the scene resolver, e.g. "chat is to your right". */
  layout?: string;
  /** Whether a movement cue is currently allowed by the initiative budget. */
  canMove: boolean;
  /** Whether a body-state change is allowed (initiative and cooldown). Defaults to canMove. */
  canChangeState?: boolean;
  /** The current body state, e.g. "sit" or "nap". */
  bodyState?: string;
  /** Plain-language mood from the affect model, e.g. "upbeat, a bit sleepy". */
  mood?: string;
}
export interface ProviderInfo {
  id: 'rules' | 'openai' | 'anthropic' | (string & {});
  kind: 'rules' | 'ai';
  /** Shown to the streamer, e.g. "Rules (not AI)" or "OpenAI-compatible: llama3.1". */
  label: string;
  model?: string;
}
export interface DecisionProvider {
  readonly info: ProviderInfo;
  decide(context: DecisionContext, signal: AbortSignal): Promise<Decision>;
}
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
