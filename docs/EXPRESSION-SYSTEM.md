# Expression system architecture

Status: implemented on the expression-system branch. Rules-based decisions are the default;
AI providers are used only when configured on the service, and the studio always shows which one
decided.

```text
Studio "say" box / live Twitch chat / (later) microphone StreamerUtterance
        |                                   studio controls (perform, move, cancel,
        v                                   quiet, retract) always win
server/companion.ts  -- bounded, source-tagged context (server/ai/context.ts)
        |  1. immediate local cue: listening/glance + thinking (open-ended)
        |  2. AiManager.decide(): active DecisionProvider with timeout, abort, budget
        |     -> OpenAI-compatible | Anthropic | rules (default and fallback)
        |  3. Zod-validated Decision -> beats/sequence (+ optional move)
        |  4. capability negotiation against the active character
        v
State { script: ExpressionScript, movement: Movement, presence: PresenceTransition }
        |  broadcast with the service clock (`now`)
        v
Avatar (studio portrait + OBS overlay)
  Performer (timeline.ts) -> layers -> composePose (manifest bindings) -> motion layer hook
  -> CharacterRenderer (Rive adapter) -> canvas
```

## Expression library (`shared/expressions.ts`)

Single source of truth. Each expression has an id, channel (`emote`, `gesture`, `attention`,
`presence`, `idle`), plain-language meaning, when to use / avoid, intensity range, typical
duration, channels it layers with, interrupt priority and model-independent `similar`
substitutes. Sequences ("beats", e.g. `doubt-then-nod`, `big-win`) chain expressions with
offsets. The AI prompt and JSON schema (`server/ai/prompt.ts`, `shared/decision.ts`), Zod
validation, the studio gallery and the rules provider are all generated from it.

## Cue contract (`shared/cue.ts`, `shared/locomotion.ts`, `shared/presence.ts`)

- `ExpressionScript`: id, sourceEventId, source, `decidedBy` {kind: manual|rules|ai|local,
  label}, priority (idle 0 < chat 1 < streamer 2 < manual 3 < control 4), `startAt` and
  `expiresAt` on the service clock, beats (expression, intensity, target, caption, offset, hold,
  group), `settle`, and `dropped` (negotiation results). Anticipation/recovery come from the
  character binding.
- `Movement` (own lane, overlaps expressions): move-to, perch, wander, return; destination
  clamped to safe bounds, optional gait/speed hint and `stay` before returning home. Placement
  changes in the studio emit a move-to cue; the AI may move only with occasional/outgoing
  initiative and a 45 s cooldown.
- `PresenceTransition`: enter/exit with a choreography id (slide, drop, walk, climb; "random"
  resolved by a seed) and the hidden amount it started from, so retract interrupts an entrance
  smoothly. All cues are sampled by time, so a reconnecting overlay shows the current state and
  never replays finished cues.

## Policy (`server/companion.ts`)

Streamer controls first. Manual studio cues outrank conversation; chat never interrupts a
streamer cue or pending streamer decision. A newer input aborts the older decision
(AbortController). Decisions older than 12 s, or arriving after quiet/retract, are dropped with a
note. "No reaction" is a valid decision. Chat must address the companion and respects
engagement, cooldown and initiative. Moderation deletes remove context and stop related cues.

## Providers (`server/ai/`)

`DecisionProvider.decide(context, signal) -> Decision`. Implementations:
`OpenAICompatibleProvider` (Chat Completions with `response_format: json_schema`, or
`json_object`/prompt-only; base URL + model cover OpenAI, OpenRouter, LM Studio, Ollama),
`AnthropicProvider` (official SDK, structured output via `output_config.format`, cached system
prompt, effort `low` by default), `RulesProvider` (deterministic). Configure the service with:

| Variable                                                                                                      | Default                                                         |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `TAVI_AI_PROVIDER`                                                                                            | `rules` (`openai`, `anthropic`)                                 |
| `TAVI_OPENAI_BASE_URL`, `TAVI_OPENAI_MODEL`, `TAVI_OPENAI_API_KEY`/`OPENAI_API_KEY`, `TAVI_OPENAI_STRUCTURED` | `https://api.openai.com/v1`, `gpt-4o-mini`, none, `json_schema` |
| `ANTHROPIC_API_KEY`, `TAVI_ANTHROPIC_MODEL`, `TAVI_ANTHROPIC_EFFORT`                                          | none, `claude-opus-5-5`, `low`                                  |
| `TAVI_AI_TIMEOUT_MS`, `TAVI_AI_MAX_PER_MINUTE`, `TAVI_AI_MAX_PER_SESSION`                                     | 8000, 8, 400                                                    |

The studio Brain section selects provider and model (`POST /api/ai`, studio-origin only; the
non-secret choice is saved to `.data/ai.json`). Keys never leave the service. Chat is wrapped in
`<chat>` tags with angle brackets neutralised and declared untrusted in the system prompt.

To add a provider: implement `DecisionProvider`, return `decisionSchema(character)`-validated
output, add it to `providerIds` in `shared/ai.ts` and to the factory in `server/ai/manager.ts`.

## Characters and renderers

See `src/renderer/characters/README.md`. `CharacterRenderer` (`src/renderer/adapter.ts`) is the
renderer seam; Rive is the first implementation.

## Motion layer hook (`src/renderer/motionHook.ts`)

`registerMotionLayer((manifest) => ({ update(input) { ... } }))`. Per frame the layer receives
dt/time, active layers (expression, channel, intensity, phase, progress, weight, target),
attention target and side, persona (attitude, initiative, personality, energy), reduced motion,
quiet, retracted, presence transition + fallback hidden amount, the base pose offset,
locomotion (home, target, current position, movement cue, viewport) and the character's
motion handles (`motionTracks`, `nodes`, `inputs`, `locomotion`). It returns optional track
samples, input values, node transforms, an additive offset, a position (locomotion), facing,
and `presence.hidden` when it performs the entrance/exit itself. Without a layer the renderer
eases position toward the target and slides/fades for entrances and exits.

A binding may set `motion: "<performance>"` (mascot: agreeing -> `nod`, skeptical -> `skeptical`, innocent -> `caught`). If the registered motion layer lists that id in `performances`, the binding's own tracks and transforms are skipped and the layer receives the cue layer in `input.performances` to drive the accent and hold; cue timing, priority and captions are unchanged. Held poses are never frozen: `play` + `pingpong` swings during the hold, fixed frames drift slightly, and `tests/living-holds.test.ts` fails if any hold renders identically over time.
