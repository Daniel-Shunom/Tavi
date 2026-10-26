# Mascot expression acting notes

How each expression in `shared/expressions.ts` is acted on the mascot rig, judged from the
expression sheet (`tools/expression-sheet/`) at overlay size (220 px tall) and large, at subtle
(0.25), typical (0.6) and strong (1.0) intensity. Acting data:
`src/renderer/characters/mascot/acting/` (core.ts and faces.ts). Engine: `src/renderer/face/`.
Each entry gives what reads and what was cut or is limited by the rig. Limits that apply to every
expression are listed once at the end.

## Current remix polish (October 26)

The original rig notes below describe the original mascot's limitations. The current Lyla v2
remix also has forearm bends, hand poses, pupils, brow tilt and an open-mouth library. Those
controls stay attached to the same skeleton and face rather than being screen overlays.

The expression review found **excited** reading as a stiff, nearly straight-arm T pose at stream
size. Its v2 elbows now bend and follow the arm accents at staggered times. **Celebrate** keeps
its broader authored motion so excitement and a full celebration remain distinct.
The measured forearm axes run in opposite semantic directions, so the v2 face metadata now
negates elbow bends when a target-aware gesture swaps arms. This keeps acknowledgement and
shrug poses anatomically consistent while preserving the calibrated body-state hand solver.

Three short custom gestures use the existing cue timing, springs, reduced-motion handling and
body-state channel ownership:

- **Thank you** (`thank-you`): open-handed acknowledgement, warm face and a single slow nod;
  mirrors its active arm and gaze toward the selected attention target.
- **Happy dance** (`happy-dance`): alternating heel lifts and shoulder/hip follow-through;
  deliberately short and grounded, for special celebrations.
- **No perch** (`perch-hesitate`): crouch and look up, notice no usable ledge, then unload onto
  the same feet. It never lifts a foot or jumps, and is excluded from autonomous AI selection.

The expression sheet at `/tools/expression-sheet/?character=mascot-v2` renders these gestures
through the actual face layer at stream size and enlarged. OBS and installed-app verification
remain separate from this browser review.

## Emotes

- **content**: open-eyed warm smile, soft head tilt and sway. Cut: closed eyes (that is
  soft-smile now).
- **amused**: happy-squint eyes, open smile, head tipped back, palms-out shrug clip, giggle pulses
  shaking the shoulders. Reads at 220 px.
- **excited**: brows high, big smile, stretch, arms flung out wide, hops on the toes. Cut: arms
  overhead (past about 2 rad they disappear behind the hair).
- **proud**: eyes closed in satisfaction, chin up, chest back, hands on hips, a self-approving nod.
  One of the strongest reads.
- **impressed**: brow pop with a blink, small "o" mouth, head pulled back, a slow nod.
- **smug**: one brow cocked, heavy lids, lopsided smile, chin up, hip popped, hands on hips. Close
  to proud in body; told apart by the open, heavy-lidded side-look.
- **teasing**: a full wink, lopsided grin, playful wave with a back-kick, shoulder shimmy.
- **skeptical**: the motion performance (lean back, head tilt, hip, hands on hips) plus a face
  pose: one brow high and one low, the low-side lid narrowed, flat mouth aside, side-eye.
- **confused**: one brow up, mouth twisted aside, hands half out. The head tilts one way, then the
  brows and mouth swap as it tilts the other.
- **thinking**: hand to chin (authored clip), eyes up and to the side drifting slowly, mouth pursed
  aside, finger-tap pulses.
- **sympathetic**: soft raised brows, gentle eyes, small sad-kind smile, head tilt, leaning in,
  a slow "aww" nod.
- **embarrassed**: brows up, nervous smile slid aside, hand behind the head (authored clip), eyes
  darting away and down, shoulders up, fidget.
- **innocent (Oops)**: the motion caught performance plus a face pose. A startled brow lift and
  wide flat "uh-oh" grimace hold for 0.4 s (onset), then a glance away with a nervous closed smile,
  quick blinks and darting checks back. Cut: teeth in the grimace (no mouth interior).
- **bored**: slump, heavy lids, flat mouth aside, head lolling with a slow sway, long blinks.
- **startled**: blink-flinch and crouch, then brows up, jaw drop, stretch, arms flaring out, a
  tiny jump and a shiver.
- **soft-smile**: eyes gently closed, small closed smile, fond tilt, hands in.
- **grin**: biggest smile with wide mouth, bright eyes, lean in, shoulders up.
- **laugh**: head back, eyes squeezed into arcs, widest mouth, shoulder-shaking pulses.
- **smirk**: one-sided smile at full mouth offset, one brow cocked, a quick chin-up. Smaller and
  quicker than smug.
- **eye-roll**: lids drop, then the whole face sweeps up and across (no pupils, so the face plane
  rolls), the head lolls back, then a slump. Cut: a pupil-only roll.
- **suspicious**: the narrowest lids, lowered brows, side-eye sweeping across and back, a slow lean.
- **deadpan**: flat stare, flat mouth, almost no motion, rare 0.5 s blinks (the Lily lesson:
  restraint reads as deadpan).
- **focused**: brows down, steady eyes, set mouth, leaning toward the screen, low blink rate.
- **determined**: lowered brows, set jaw, hands on hips, a firm nod.
- **frown**: lowered brows, mouth turned fully down, arms in, a glare toward the target.
- **pout**: small raised mouth turned down, looking away, chin down, shoulders up, a sulky glance
  back. Cut: a pushed-out lower lip (no lip shapes).
- **annoyed**: heavy lids, lowered brows, flat mouth aside, hands on hips, foot tapping, glare at
  the target.
- **sad**: raised brows, heavy eyes, mouth down, head and shoulders drooping, arms hanging,
  occasional glance up. Cut: tilted inner brows (the brows only move vertically).
- **worried**: brows up, tight wavering mouth, shoulders up, hands in, glancing side to side,
  fidget.
- **wince**: eyes squeezed, mouth pulled tight, flinch back and away (onset), shoulders up.
- **grossed-out**: one side of the face scrunched, mouth pulled down and aside, recoiling with a
  shiver, arms in.
- **shocked**: brows at maximum, a wide flat stunned mouth, stretched tall, arms out, frozen
  stare with no blinks. Cut: hands to cheeks (the arms cannot reach the face cleanly).
- **sleepy**: drooping lids, head lolling, nodding off, a yawn with a stretch every 6 s, long
  blinks.
- **blush**: shy closed-eye smile, head tucked, hand behind the head, twisting side to side. Cut:
  the actual cheek blush (the rig's cheek colour is fixed; see RIG-SPEC).

## Gestures

- **wave**: the authored wave clip with a bright face, turned toward the target.
- **celebrate**: the authored celebration clip with joyful closed eyes and hops.
- **agreeing**: the motion nod (head pitch through the face plane, body follow-through) plus a warm
  face.
- **disagreeing**: a head shake, done as the face turning side to side with the head tilt
  following, plus a flat mouth, lowered brows and arms in.
- **point**: arm raised toward the target (mirrored for targets on the left), eyes following,
  brows up. Replaces the old glance fallback. Cut: an extended index finger (the hands have no
  poses).
- **shrug**: palms-out authored shrug, shoulders up (onset), brows up, flat sideways mouth, head
  tilt.
- **sassy**: hands on hips, hip pop, one brow up, lips pursed aside, head waggle.

## Attention

- **listening**: turned toward the speaker, leaning in, brows up a touch, small slow nods.
- **glance**: a quick face turn toward the target with a brow flick.
- **look-away**: face turned away and up, lips pursed, chin up.

## Limits that apply to every expression

- The mouth is a single stroked curve: it can curve, slide and lower, but it cannot open and has
  no teeth or tongue. It is a few pixels wide at 220 px, so emotion at stream size comes mostly
  from the brows, lids, head and body.
- There are no pupils: gaze turns the whole face plane.
- There is no head pitch bone, so nods pitch the face plane.
- The hands have no poses: pointing, hands to the face and palms out come only from authored
  clips.
