# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Streamers who want a customizable animated companion to add personality to their livestream.

## Product Purpose

Tavi is a character-led companion that lives in an OBS Browser Source. Success means streamers can make Tavi feel like their own and have it add expressive presence without taking over the stream.

## Positioning

Tavi is designed as a companion that shares the stream scene: it can move, orient toward scene areas, and react to bounded events instead of serving as a static sticker. Current live chat reactions are rule-based, not AI-generated.

## Operating Context

Streamers configure Tavi in the Studio, then add its transparent browser overlay to OBS. Twitch chat can be connected for bounded reactions. The public landing page uses a fictional, clearly labeled stream preview.

## Capabilities and Constraints

- Character appearance, wardrobe, personality, gestures, placement, and behavior can be configured in Studio.
- OBS scene layout and webcam source awareness are part of the streamer setup flow.
- Twitch device authorization and EventSub chat are implemented; chat reactions use bounded rules.
- Microphone transcription and live AI decisions are subsequent milestones and must not be described as working features.
- The landing page's scroll cues are authored local choreography, not AI behavior.

## Brand Commitments

The user prefers a playful, warm, character-led identity with layered atmosphere, soft lavender light, and tactile controls. Keep the existing character style and make new visual material feel dimensional and carefully integrated. Avoid a corporate font look.

## Evidence on Hand

- Rive character assets and the in-repo renderer under `src/renderer/`.
- Fictional stream backdrop at `public/media/tavi-stream-forest.png`; its generation prompt is embedded in the PNG metadata.

## Product Principles

- The companion is the emotional center of the experience.
- Streamers control how Tavi looks and behaves.
- Clearly distinguish live integrations, local rules, and fictional demonstrations.
- Keep Tavi aware of the scene and the person interacting with it.
