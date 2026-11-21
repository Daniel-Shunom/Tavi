# Behaviour engine

This folder owns what Tavi chooses to do. The renderer owns how those choices move
the character.

- `engine.ts`: `Companion`, the authoritative coordinator. Receives controls,
  streamer input and stream events; resolves priorities and publishes performance
  state. The service imports this entry point directly.
- `affect.ts`: emotion, mood, fatigue and stimulation rules, plus their effect on
  rest timing.
- `states.ts`: chat-burst detection and quiet-time body-state decisions.
- `life.ts`: autonomous activity selection using mood, personality, scene places
  and recent activity.
- `pacing.ts`: automatic reaction intensity and recovery periods.
- `reactions/`: conversation rules, chat eligibility, support-event beats, stream-event reactions,
  mood shading, and scolding/forgiveness recognition.

Inputs flow through the coordinator into timed expression scripts, body cues,
attention targets and movement. Controls take priority over manual cues, streamer
conversation, chat and autonomous activity, in that order.

Twitch adapters remain in `server/twitch/`; optional decision providers remain in
`server/ai/`; its default/fallback rules live in `reactions/conversation.ts`.
Providers propose bounded decisions; the engine validates and
schedules them. Neither integration owns the character's behaviour state.

`shared/affect.ts` contains the serialized affect snapshot, its neutral default
and the energy helper used by the renderer. Other shared contracts describe
expressions, cues, body states and movement. They do not import server code.
`src/renderer/motion/` executes the resulting performance and supplies procedural
motion; it does not select high-level activities.

Behaviour tests live in `tests/`, including `companion`, `affect`, `body-states`,
`life`, `chat-reactions`, `support-events` and `stream-events`. Their existing
clock-controlled scenarios cover the engine without relying on live services.
