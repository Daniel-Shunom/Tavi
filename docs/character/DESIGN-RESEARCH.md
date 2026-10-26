# Character design research: Duolingo, Rive and facial expression

Status: research notes for Tavi's face pose system (`src/renderer/face/`) and the rig spec
(`docs/character/RIG-SPEC.md`). Claims are sourced. Lines marked _heuristic_ are my synthesis,
not a cited fact. Researched October 25, 2026.

## 1. How Duolingo builds its Rive characters

### What Duolingo has published

- **Why Rive.** For lip sync across "40+ languages" and "100+ courses", hand-animating "the lip
  movement for our ten World Characters was completely out of the question". They chose Rive for
  small files, a clean animator-to-engineer handoff, and its State Machine, which controls "which
  animation states are called, how they are called, and how they transition and blend"
  ([Duolingo blog: World Character visemes, Vahidsafa and Lenzo, Nov 2022][visemes]).
- **Mouths are their own layer.** Each character has general lesson-pose states plus separate
  mouth states that run **concurrently** with the body. Each character has "20+ mouths", and
  the same state-machine logic works whatever the count ([visemes]).
- **Data drives the face, not hand keys.** Speech is run through Duolingo's speech recognition
  and pronunciation models to get word and phoneme timings. These are converted to viseme
  timings, audited, and played back by setting state-machine inputs in sync with the audio
  ([visemes]). A Rive staff reply on the forum recommends the same pattern: viseme states
  selected by a number input, with code converting audio into that number ([Rive forum: lip
  sync][forum-lipsync]).
- **A design guide per viseme set.** A guide defines how every viseme should look. Each
  character gets its own set that reflects its personality but follows the shared rules. The
  acceptance test was whether the shapes "looked believable when animated" ([visemes]).
- **Idle life is part of the rig.** Idle behaviours include head nods, blinking and eyebrow
  movement. After an answer the character moves to a reaction state for right or wrong
  ([visemes]).
- **Lily (Video Call, 2025).** One State Machine drives mouth positions, facial expressions,
  camera moves and other animation by blending modular pieces at runtime. **Nested artboards
  separate the head and body** so each moves independently. **8 head and 8 body idle animations
  combine into 64+ neutral variations**, so the loop never repeats visibly. Processing delays
  read as thinking ("intentional rather than mechanical"): a head tilt or pondering look.
  Confusion is a squint or head shake; being impressed is a raised eyebrow and an approving nod;
  listening is leaning in or furrowing the brows. **Opening her eyes too wide read as oddly
  happy, so they dialled exaggeration back to keep her deadpan.** Inputs were named logically
  for developers; a new file shipped weekly ("Riv Deliv"); the file is under 1 MB ([Rive blog:
  Lily Video Call, Veteto, Mar 2025][lily]).
- **Reusable rigs at scale.** Duolingo's "Maker" system gives animators reusable character rigs
  and animation building blocks for all in-lesson characters. Technical animators build it with
  creative technologists. This is known only from a Duolingo "Inside Design Studio" post
  reshared on LinkedIn; no engineering write-up was found ([LinkedIn repost][maker]).

### Art style and consistency

- **Shape language.** Use few shapes, rounded edges and no points. Read the silhouette first,
  with "only the detail required" to make the subject obvious. Detail is chosen to be
  recognisable at small sizes. Key features are exaggerated "almost to the point of caricature"
  ([Duolingo blog: Shape language, Barker, Jul 2020][shape]). The public illustration guide
  (design.duolingo.com, now redirected to the blog hub) builds characters from one or two basic
  shapes for the head and body, uses geometric eyes in a few fixed styles, and repeats shapes
  for cohesion.
- **One family resemblance.** The human cast was designed to reflect Duo's four key
  components: simple geometric construction, big eyes, a unique body shape and detached feet
  ([Duolingo blog: Building character, Hartman, Nov 2020][building]).
- **Motion draws the eye**, so animation is used deliberately ([shape]).

### Gaps (not published)

I found no public Duolingo material on the exact bone layout, joystick use, blend-state curves
or transition durations, and no "Duolingo character design" agent skill (see the skill audit in
the final report). Third-party "Duolingo-style" posts on dev.to are marketing for an agency and
are not used here as evidence.

### What Tavi takes from this

1. **Separate face from body.** Mouth, brows and lids form a layer that runs concurrently with
   body clips (Duolingo's mouth states; Lily's nested head artboard). Our face pose layer is
   additive over motion's idle and performances for the same reason.
2. **A small set of building blocks, combined at runtime, not one clip per emotion.** Lily's 8×8
   idle grid is the model for living holds: a few independent micro-motions with incommensurate
   periods.
3. **Restraint.** "Too wide reads as happy" is the Lily lesson. Tavi's default attitude is cheeky
   and chill, so default intensities are moderate, and `strong` variants are opt-in.
4. **Every expression gets a written spec** (a meaning, when to use it, when not to), like
   Duolingo's viseme design guide. `shared/expressions.ts` is that guide; the AI reads it.
5. **Name inputs for developers.** Our manifest consumes named joystick channels; the artist spec
   asks for the same names inside the file.

## 2. Rive rigging guidance

- **Joysticks** scrub the timeline assigned to each axis; a single axis acts as a slider. They
  bundle many keyed properties into one control (e.g. eyes and head together). They support
  invert and a handle source, and their position can be keyed ([Rive docs: joysticks][joysticks]).
  The mascot rig animates every expression through joysticks, which is why our face poses are
  joystick targets.
- **Bones and meshes.** Bones bend bound vector paths or image meshes. Vertices near a joint
  should be weighted to both neighbours for smooth bends; rigid parts (hands, shoes) are
  parented instead of bound ([Rive docs: bones][bones]).
- **Constraints**: IK, distance, transform, translation, scale and rotation. IK keeps feet planted
  while knees bend ([Rive docs: constraints][constraints]).
- **State machine layers** each play one state at a time. Layers run concurrently, and a lower
  layer wins when two layers key the same property ([Rive docs: layers][layers]). Face (mouth,
  brows, eyes, blink) and body therefore belong on separate layers that key disjoint properties.
- **Blend states.** A 1D blend mixes timelines by one number. An additive blend mixes several
  timelines, each by its own number, over a baseline "Blend by Value" pose, and is meant for
  "poses and facial positions". Mixing is additive, not linear, and can surprise ([Rive docs:
  states][states]).
- **Transitions** default to duration 0 (a snap) and linear interpolation. Cubic is available.
  "Allow exit during transition" makes them interruptible ([Rive docs: transitions][transitions]).
  A snapping default is why unpolished rigs look poppy: _heuristic_.
- **Data binding** is the current recommended input mechanism (state machine inputs are
  deprecated in its favour). The motion research covers this in `docs/motion/RESEARCH.md`.

## 3. Facial expression design (FACS simplified for a chibi)

FACS describes faces as action units (AUs) ([Ekman and Friesen, 1978][facs]). A cartoon rig
needs only a handful. This is how Tavi's channels map to them:

| AU (FACS)                   | Cartoon control                | Tavi channel               |
| --------------------------- | ------------------------------ | -------------------------- |
| AU1 inner brow raiser       | brow up / worried tilt         | `browL/R` (negative = up)  |
| AU2 outer brow raiser       | surprised arch                 | `browL/R` (no inner/outer) |
| AU4 brow lowerer            | frown, anger, focus            | `browL/R` (positive)       |
| AU5 upper lid raiser        | wide eyes (shock)              | not in rig (see RIG-SPEC)  |
| AU6 cheek raiser + AU7 lid  | smile eyes, suspicion squint   | `squintL/R`                |
| AU43/45 eyes closed / blink | blink, sleepy                  | `blinkL/R`                 |
| AU12 lip corner puller      | smile                          | `smile` (positive)         |
| AU15 lip corner depressor   | frown, sad                     | `smile` (negative)         |
| AU14 dimpler (one-sided)    | smirk                          | `mouthX` + asymmetric brow |
| AU26/27 jaw drop            | open mouth, laugh, yawn, shock | `mouthY`                   |
| head/gaze (AU51–64)         | turn, tilt, look               | `gazeX/Y`, head nodes      |

Readable combinations (after Ekman's basic emotions, adapted). _Heuristic_ for the cartoon weights:

- **Sad**: inner brows up (AU1+4), lids heavy, mouth corners down, gaze down.
- **Angry/annoyed**: brows down and in (AU4), lids narrowed (AU7), mouth flat or pressed down.
- **Surprise/shock**: brows up (AU1+2), eyes wide (AU5), jaw drop (AU26) and a stretch.
- **Disgust**: brow lower, squint, mouth pulled to one side and down (AU9/10 approximated by
  asymmetry and a frown), head pulled back.
- **Contempt/smirk**: unilateral lip corner (AU14), the only asymmetric basic emotion; it pairs
  with one raised brow for skepticism.
- **Happiness**: Duchenne smile = AU6 + AU12. Squinted lower lids are what make a smile read as
  genuine rather than polite.

**Asymmetry.** Unilateral AU14 is the classic contempt signal ([facs]). One brow up, one down,
and a sideways mouth are the cheapest ways to signal skepticism, smirking or an eye roll. Symmetric
faces read as calm, formal or "posed" (_heuristic_, standard animation teaching; see Osipa's
treatment of brows and lids in [Stop Staring][osipa]).

## 4. Chibi appeal at overlay size (about 220 px tall)

- At 220 px tall the mascot's head is about 90 px and an eye is about 10 px. **Brows are a few
  pixels**, so a brow change alone does not carry at overlay size. Each pose must also move a
  larger feature: squash, head tilt, gaze direction, mouth curve or blink. This is consistent
  with silhouette staging and Valve's TF2 stylization talk ([TF2 GDC 2008][tf2]) and with
  Duolingo's "silhouettes first" rule ([shape]).
- Big head, big eyes and a small mouth (_Kindchenschema_, Lorenz) give chibi appeal. Push the
  eyes and brows, keep the mouth small, and get a smile from curve plus lid squint rather than
  mouth size.
- **Clear contrast between neighbouring expressions** matters more than nuance. Every pose is
  checked side by side at overlay size on the expression sheet, and near-duplicates are merged
  or removed.

## 5. Smooth expression transitions

- **Critically damped springs per channel.** Each channel chases its target with a critically
  damped spring, so retargeting mid-flight is velocity-continuous and never jumps. This is the
  standard game-animation approach ([Holden: Spring-It-On][springs]).
- **Inertialization.** On a switch, record the offset between the old and new pose and decay it
  to zero, rather than cross-fading two evaluated poses. This avoids double evaluation and keeps
  velocity continuous ([Bollo, GDC 2018][bollo]; [Holden: Dead blending][dead]). On a 13-channel
  face the cost is trivial either way. Our springs are equivalent to inertializing toward the
  new target, which is the property that matters.
- **Overlapping action and follow-through.** Parts should not all move in sync ([Thomas and
  Johnston, The Illusion of Life, 1981][iol]). For faces, the brows lead and the mouth follows.
  Tavi's face layer delays the mouth by about 50–100 ms behind the brows and eyes, and the head
  follows the face. _Heuristic_ timing; it matches the motion layer's "brows recover first"
  release.
- **Anticipation.** For startle and shock, a short blink or squash before a big brow lift sells
  the change. For slow emotions (sad, sleepy), use no anticipation and a slow attack.
- **Living holds.** A held face is never frozen: brow micro-drift, lid breathing, mouth-corner
  twitches and blinks at irregular, Poisson-like intervals. Blink rate goes down when focused
  and up when nervous, and long blinks go with sleepy or deadpan. This is the same principle as
  Lily's combinatorial idles ([lily]) and the motion layer's "moving holds".
- **Blinks on big changes.** A blink during a large eye or brow change hides the transition and
  reads as natural (_heuristic_, standard practice).

## 6. Mouths, the Duolingo way

### What Duolingo has published

- Mouths are their own state-machine layer, with states built "just for mouths" that run alongside
  the pose states. The logic is the same whether a character has 4 mouths or "more than 20
  shapes" ([visemes]).
- Each character has its own set of 20+ mouths, drawn to its personality from a shared viseme
  design guide. The acceptance bar is "believable when animated" ([visemes]).
- Speech timing data drives the mouth layer in sync with audio. Lily's mouth positions and
  expressions are blended by the state machine at runtime rather than hand-animated per
  reaction ([visemes], [lily]).
- The standard viseme groups apply. Lips pressed (M/B/P), teeth on the lower lip (F/V) and tongue
  (TH, L) are the shapes that need teeth or tongue drawn ([azure-visemes]; third-party Rive
  tutorials describe the same grouping for Duolingo-style rigs).

### What the characters show (from their public artwork and app; _observation_, not a spec)

- **A mouth is a filled shape, not an outlined hole.** Open mouths are a single dark fill (deep
  plum or maroon rather than black) with a tongue and a band of teeth as separate flat fills
  inside it. There is no lip outline. Closed mouths are a simple short stroke or a tiny filled
  sliver.
- **The silhouette carries the emotion.** Each emotion has its own shape rather than one shape
  stretched: a wide D-shaped grin (flat top, round bottom) for joy, a tall oval for shock, a
  rounded triangle for a shout, a tiny "o" for surprise, a wobbly or zigzag line for unease, a
  lopsided curve for a smirk, a teeth-forward rounded rectangle for a grimace.
- **The shapes are exaggerated.** At the size the characters appear in lessons, a mouth is often
  as wide as an eye pair and opens to half the face's lower height. Tongues and teeth are big,
  simple shapes: two or three rounded fills, never individual teeth unless the gag needs it.
- **They read small because of contrast and silhouette.** The dark interior against skin, plus
  one bright inner shape (white teeth or a pink tongue), stays legible at a few dozen pixels;
  fine curves and outlines do not.
- **Swaps over morphs.** Distinct shapes are swapped (with the head, brows and squash selling
  the change) rather than morphed point to point. Within a family (open to more open, wider to
  narrower), the shape scales smoothly.

### What Tavi takes from this (Lyla v2)

1. The closed mouth stays a line. Every open mouth is its own filled shape (dark interior,
   separate teeth and tongue fills, no outline), selected by `mouthShape`.
2. Continuous axes (`mouthOpen` for height, `mouthWide` for width, `mouthTilt` for lopsidedness)
   vary a shape smoothly. Changes between incompatible shapes are a quick swap hidden by a
   ~40 ms squash pop.
3. Exactly one mouth is visible at any time. The line shows only for the closed shape, keyed on
   the same frames as the shape selection.
4. Speech visemes (A, E, I, O, U, M/B/P, F/V, L, rest) map onto the same library plus axes.
5. Shapes are judged at 220 px first: big, dark, simple, one bright accent.

## Sources

[visemes]: https://blog.duolingo.com/world-character-visemes
[forum-lipsync]: https://rive.app/community/forums/support/fsnLLkXUaA62/lip-sync/ftyrdnSzhsd7
[lily]: https://rive.app/blog/duolingo-s-ai-powered-video-call-brings-lily-to-life
[maker]: https://ua.linkedin.com/in/denis-kaita
[shape]: https://blog.duolingo.com/shape-language-duolingos-art-style/
[building]: https://blog.duolingo.com/building-character/
[joysticks]: https://rive.app/docs/editor/manipulating-shapes/joysticks
[bones]: https://rive.app/docs/editor/manipulating-shapes/bones
[constraints]: https://rive.app/docs/editor/constraints/constraints-overview
[layers]: https://rive.app/docs/editor/state-machine/layers
[states]: https://rive.app/docs/editor/state-machine/states
[transitions]: https://rive.app/docs/editor/state-machine/transitions
[facs]: https://www.paulekman.com/facial-action-coding-system/
[osipa]: https://www.wiley.com/en-us/Stop+Staring%3A+Facial+Modeling+and+Animation+Done+Right%2C+3rd+Edition-p-9780470609903
[tf2]: https://cdn.fastly.steamstatic.com/apps/valve/2008/GDC2008_StylizationWithAPurpose_TF2.pdf
[springs]: https://theorangeduck.com/page/spring-roll-call
[bollo]: https://www.gdcvault.com/play/1025165/Inertialization
[dead]: https://theorangeduck.com/page/dead-blending
[iol]: https://en.wikipedia.org/wiki/The_Illusion_of_Life
[azure-visemes]: https://learn.microsoft.com/azure/ai-services/speech-service/how-to-speech-synthesis-viseme

- Duolingo: [World Character visemes][visemes], [Shape language][shape],
  [Building character][building], [Lily Video Call (Rive blog)][lily], [Maker (LinkedIn
  repost)][maker].
- Rive: [joysticks], [bones], [constraints], [layers], [states], [transitions],
  [lip sync forum reply][forum-lipsync].
- Animation: [FACS][facs], [Stop Staring][osipa], [TF2 stylization][tf2],
  [Spring-It-On][springs], [Inertialization][bollo], [Dead blending][dead],
  [The Illusion of Life][iol].
