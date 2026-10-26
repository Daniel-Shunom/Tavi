# Posing and staging for Tavi

Research for the posing and staging work: how to pose a 1.7-head chibi bone rig so its states
(idle, sit, climb, knee-dust, nap, lean, peek and new ones) read as real at stream size, and how
to stage them against the streamer's scene frames. It drives the pose pipeline
(`docs/motion/POSE-PIPELINE.md`, `src/renderer/motion/pose/`, `tools/pose-lab/`).

Sources are linked inline. Rules marked _synthesised_ combine several sources with our rig
measurements and are not quoted from any one source. Numbers marked _measured_ come from the
real Lyla v2 rig through `tools/pose-lab/measure.html` (bone world transforms through the
production binding). Units: **BH** = body heights (the 600-unit artboard; 1 BH = 176 px on a
1280 x 720 overlay), rest space = origin at the soles' centre, +x screen right, +y up.

## Summary

1. **Pose for the silhouette, then for the face.** At overlay size Tavi's visible body is about
   140 px tall, the head about 80 px, an arm about 29 px and a hand about 6 px. Staging, line of
   action and limbs held clear of the body mass carry the pose; the face and the hands are
   accents ([Lasseter 1987](https://www.ics.uci.edu/~fowlkes/class/ics162/exercises/lasseter.pdf);
   [Valve, TF2 NPAR 2007](https://www.cs.princeton.edu/courses/archive/fall07/cos597B/papers/mitchell-team-fortress.pdf)).
2. **Tavi's proportions dictate the cheats.** The head is 58% of the visible height and 2.8x the
   torso width. Fully raised, a hand reaches only 0.52 BH above the soles, which is eye height
   (_measured_). A hand can never rise above the head. Every pose that puts the hands near an
   edge or the face must be staged around that, as in the "Kilroy" climb below.
3. **Weight first.** Every held pose names its contacts and keeps the centre of mass over them.
   Every transition shows the weight moving onto the new support before the old one lets go
   ([Garcia, Animation Physics 4](https://www.animatorisland.com/principles-of-animation-physics-part-4/)).
4. **Never twin.** Both arms or both legs doing the same thing reads "stiff, wooden"
   (Lasseter). Offset the sides in angle and in time (1-3 frames), and work elbow against elbow
   and knee against knee
   ([Stanchfield, _Gesture Drawing for Animation_](https://archive.org/details/ART15PDT)).
5. **Puppet rigs look like paper dolls when parts only rotate.** The fixes are overlap, draw-order
   swaps at the moment a limb crosses the body, part swaps (hand poses) instead of rotating a flat
   part, and hiding limbs behind the body or the scene. The v2 rig has the tools for this:
   elbows, five hand poses and an arms-in-front switch.
6. **The scene is part of the pose.** Edges occlude, support and frame. A climb reads when the
   edge hides the body and the hands are on top of the edge. A ledge sit reads when the legs hang
   in front of the frame. Shadows belong to the surface the body touches.
7. **Holds must live, in the right place.** Use breath, weight shifts, eyes and leg swings, not
   random drift; the drift follows the last momentum
   ([Kelly, moving holds](https://newsletters.animationmentor.com/newsletter/0609/feature_geek.html);
   [AnimSchool, moving holds](https://blog.animschool.edu/2024/11/27/create-moving-holds-animating-nothing/)).
8. **A rubric, checked by machine where possible** (end of this document). The pipeline measures
   contacts, balance, draw-order mistakes, root bobbing, continuity, separation of limbs from the
   body mass and living holds.

## 1. Principles that matter at 140 px

### Staging and silhouette

- Stage one idea at a time, "completely and unmistakably clear"; in a still scene the eye goes
  to what moves, in a busy one to what is still (Lasseter, after Thomas and Johnston,
  [_The Illusion of Life_](https://en.wikipedia.org/wiki/Disney_Animation:_The_Illusion_of_Life)).
  On stream the background (the game, the webcam) is busy, so Tavi's states should be calm with
  one clear accent at a time.
- Stage in silhouette: "a hand in front of a chest would simply disappear" (Lasseter). For Tavi
  the head is the chest: anything in front of the head disappears into it unless it contrasts.
  Arms that must read go **beside** the head or body, not across it.
- Pull limbs out of the body mass so the pose is "clear in the silhouette"; avoid tangents
  ([Engländer, Perfect Posing 2](https://www.animatorisland.com/perfect-posing-2-appealing-and-readable/);
  [AnimSchool, pushing poses](https://blog.animschool.edu/2018/08/06/pushing-poses-through-iteration/)).
  Chibi limbs are short, so poses easily look "balled up"; keep arms and legs clear of the head
  and torso and run a solid-colour silhouette check
  ([Clip Studio, posing chibis](https://tips.clip-studio.com/en-us/articles/4856)).
- Valve validated every TF2 character "only in silhouette with no internal shading" (NPAR 2007,
  above). Pixel artists zoom out to real game scale and cut detail that turns to mush, and test
  in grayscale ([Wayline, readability](https://www.wayline.io/learn/pixel-art/4)). For Tavi, the
  silhouette test is at 176 px BH over a busy frame.

### Line of action, tension and straights against curves

- One clear line of action from the support through the hips and spine to the head; push it to
  reflect the story and carry it through the limbs (AnimSchool, above;
  [Preston Blair, _Cartoon Animation_](https://mitpressbookstore.mit.edu/book/9781633228900)).
  A C-curve reads relaxed (slouch, doze), a straight or reversed curve reads alert (peek, pull).
- "Any time you pull a figure off its perpendicular norm you create tension"; beginners
  straighten poses until they are "too straight up and down" (Stanchfield, "Angles and
  Tension"). "All curves and no straights make a dreary drawing": the straight goes on the
  stretch side and the curve on the squash side (Stanchfield, "Straight against curve";
  [_Drawn to Life_](https://www.routledge.com/Drawn-to-Life-20-Golden-Years-of-Disney-Master-Classes-Volume-1-The-Walt-Stanchfield-Lectures/Stanchfield-Hahn/p/book/9781032104416)).
- Tavi has no spine chain: the line of action is the path soles → hips → torso pivot → neck →
  head centre. It bends through `bob` and `shift` (hips), `lean` (torso) and `headTilt` (head).
  Because the head is so heavy, a small torso lean plus a head tilt the same way gives a C; the
  head tilt against the lean gives an S. Pushing angles 1.5-2x beyond realistic values is needed
  at this size (BODY-STATES-RESEARCH).

### Weight and balance

- The body is in static balance when the centre of mass (pressure) falls inside the base of
  support; a sideways weight shift raises the hip on the support side, and "it should be clear
  whether a character is standing or sitting" even when only part of it is visible (Garcia,
  above). The pit of the neck sits over the supporting foot
  ([Life Drawing Academy](https://lifedrawing.academy/drawing-lessons/how-to-draw-person)).
- Know where the weight is on every drawing ([Williams, _The Animator's Survival
  Kit_](https://en.wikipedia.org/wiki/The_Animator%27s_Survival_Kit), Faber, ISBN
  9780571238347).
- Tavi's centre of mass is high, in the lower head (silhouette area centroid 0.47 BH above the
  soles, _measured_), and the stance is narrow (soles about 0.12 BH wide). So a standing pose
  tips visibly out of balance with only about 0.06 BH of head offset. Leans and reaches must be
  balanced by moving the hips the other way or by adding a contact (a hand on the frame, a
  shoulder on a wall).
- Contrapposto: weight on one leg, "balanced but asymmetrical"; the weight-bearing hip rises and
  the opposite shoulder drops; the tense leg pairs with the relaxed arm
  ([Smarthistory](https://smarthistory.org/contrapposto); [Creative
  Bloq](https://www.creativebloq.com/art/how-to-draw-a-male-figure)). On Tavi: `shift` the
  hips over one foot, lean the torso back the other way, tilt the head with the torso, and give
  the arms different angles.

### Appeal and chibi proportions

- Chibi heads are a third to a half of the height with stubby limbs
  ([Wikipedia, chibi](<https://en.wikipedia.org/wiki/Chibi_(style)>)). Tavi is beyond that range
  (58%), so "exaggerated bodies deserve exaggerated poses" (Clip Studio, above).
- What reads on Tavi: the head height (crouching and sitting read through the head dropping),
  whole-body rotation about a contact, the head tilt, arms angled clear of the head, and the
  legs only where they are the silhouette (dangling over a ledge, a foot on an edge).
- What does not read: torso detail, small wrist angles, fingers, and anything in front of the
  face. Asymmetry in the arms reads more than asymmetry in the legs.

### Living holds

- A frozen pose looks dead; too much motion looks floaty. Overshoot the pose and settle; stagger
  the stops so wrists, head and hips do not settle on the same frame; keep the eyes alive; add
  breath and small weight shifts, not random motion (Kelly, above). The drift follows the
  direction of the most recent momentum shift, and the head follows the body (AnimSchool, above).
- Tavi's motion core already layers breath, blinks and gaze. A state's hold adds what belongs
  to the state: leg swing on a ledge, weight shifts in a lean, reading saccades in a peek, sleep
  breath in a nap.

## 2. Posing a 2D bone rig without the paper-doll look

Cut-out and bone rigs (Toon Boom Harmony, Spine, Live2D, Rive) share the same failure: parts
only rotate, so poses look flat, limbs hinge like card and the body never overlaps itself.

| Technique                     | Source practice                                                                                                                                                                                                                                                                                                             | Tavi v2                                                                                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Part swaps for foreshortening | Harmony keeps several drawings per hand layer "to allow for quick hand rotations" ([Toon Boom, swapping drawings](https://docs.toonboom.com/help/harmony-21/premium/cut-out-animation/about-swap-drawing.html)); Spine attachment keys swap images ([Spine keys](https://esotericsoftware.com/spine-keys))                  | Hand poses `handL/R` 0 rest, 1 open, 2 fist, 3 point, 4 thumbs up. Swap on contact (open palm slaps the edge, fist grips it).                  |
| Draw-order swaps              | Rive draw rules restack a drawable and are keyed as hold keys because draw order "cannot be interpolated" ([Rive, draw order](https://rive.app/docs/editor/animate-mode/animating-draw-order)); Live2D binds draw order to parameters ([Cubism draw order](https://docs.live2d.com/4.2/en/cubism-editor-manual/draworder/)) | `armsFront` 0/1. Swap where the arm crosses the hair outline or while it moves fast, never while a hand rests on the hair edge.                |
| Two-bone limbs with IK        | Rive IK needs a chain and a target, Invert Direction flips the bend ([Rive IK](https://rive.app/docs/editor/constraints/ik-constraint)); Spine IK keeps feet from sliding and softness avoids the snap at full extension ([Spine IK](https://esotericsoftware.com/spine-ik-constraints))                                    | Legs: IK on the foot targets. Arms: shoulder rotation plus elbow, solved by our pose pipeline toward a hand target (hands planted on an edge). |
| Weighted joints               | Weight vertices near a joint to both bones so the bend blends ([Rive bones](https://rive.app/docs/editor/manipulating-shapes/bones); [Spine weights](https://esotericsoftware.com/spine-weights))                                                                                                                           | Authored in the remix; keep elbow bends under about 2 rad to stay inside the weighting.                                                        |
| Physics for secondary motion  | Live2D pendulums driven by head and body ("ease of swinging" 0.7-0.99) keep holds alive ([Cubism physics](https://docs.live2d.com/en/cubism-editor-manual/physics-operation/))                                                                                                                                              | Hair channels follow sway and travel through the motion core's second-order spring.                                                            |
| Offset timing (overlap)       | Offsetting keys creates follow-through and overlap (Spine keys); Lasseter's Andre moves the right arm, then the left                                                                                                                                                                                                        | Beats offset the sides by 0.03-0.08 s; the pose spring adds lag per channel.                                                                   |
| Hide what cannot be drawn     | _Synthesised_: hide or overlap a limb behind the body rather than rotating a flat part past about 45°                                                                                                                                                                                                                       | Arms behind the hair (`armsFront` 0) for hands "in the lap"; the scene edge hides the lower body during a climb.                               |

Rig facts that constrain every pose (_measured_ on v2, rest space):

| Part                      | Value                                                                                                                                                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shoulders                 | L (-0.039, 0.355), R (0.061, 0.355); upper arm 0.087, forearm 0.078 (reach 0.165 BH, 29 px)                                                                                                                    |
| Shoulder rotation         | `armL`/`armR` + raises outward on both sides                                                                                                                                                                   |
| Elbow                     | `elbowL` + folds the left forearm **in** (toward the body); `elbowR` + swings the right forearm **out**. The binding's sides do not mirror each other (reported as a rig request); the pose solver handles it. |
| Neck pivot, head          | Neck (0.013, 0.395); head ellipse centre about (0.005, 0.56), radii 0.25 x 0.23; head top 0.79; eyes 0.54                                                                                                      |
| Hips, legs                | Hips (0.012, 0.265); thigh 0.119, shin 0.112; knees bend toward +x; foot IK targets L (-0.007, 0.031), R (0.038, 0.033)                                                                                        |
| Seat                      | Skirt hem about 0.08 below the hips; floor seat at hips down 0.177 (106 u)                                                                                                                                     |
| Highest hand              | 0.52 above the soles, at eye height. A hand can never go above the head.                                                                                                                                       |
| Arms in front of the hair | Above about 1.6 rad the arms vanish behind the hair unless `armsFront` is 1, and then they cover the face                                                                                                      |

v1 (the shipped mascot) has the same skeleton but single-rotation arms (no elbows), no hand poses
and no draw switch. Its fallback drops the hands and solves arm contacts with the shoulder alone.

## 3. Staging against the scene

The overlay is a transparent layer above the streamer's scene. The webcam, game and chat
rectangles (`config.scene`) are surfaces Tavi can sit on, lean against, hide behind and climb
over. Three tools exist: placement (where the soles or the seat are), the clip mask (hide below a
line) and the contact shadow (drawn on the surface touched).

### Climbing up over an edge

References: Jordan Mechner rotoscoped his brother scaling walls and hanging by his fingers; the
"endearing awkwardness" survived even in a few pixels
([Ubisoft, Prince of Persia 35th](https://news.ubisoft.com/en-us/article/6yLrRf7b0U1MBYxmlxE225/prince-of-persia-35th-anniversary-a-look-back-at-the-original-game)).
Practitioners break the mantle into pull with the arms, push away with the legs, lift until the
arms lock straight, then "a small pop" to get the legs over, with anticipation and overshoot
([Polycount ledge-climb thread](https://polycount.com/discussion/comment/1121962)). Game
traversal animation is covered in
[Cooper, _Game Anim_](https://www.gameanim.com/book/). Shimeji's `ClimbWall`, `HoldOntoIEWall`
and `PullUp` actions are the overlay-pet precedent
([actions.xml](https://raw.githubusercontent.com/chaoskagami/shimeji-ee/master/conf/actions.xml)).

The classic breakdown, adapted to Tavi's reach (_synthesised_):

| Beat                 | What reads                                                                                 | Tavi (edge at y 0, lift = soles below the edge)                                                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Hands appear      | Hands slap onto the **top** of the edge, fingers over it, one then the other               | A hand only reaches eye height, so the top of the head and the eyes come up **with** the hands: the "Kilroy" peek. Hands wide (±0.17 BH) beside the cheeks, open palms, then fists, `armsFront` 1 |
| 2. Hang              | Weight on straight arms, a small struggle (legs kick under the edge)                       | Lift about -0.47; small vertical sway; eyes look over the edge and around                                                                                                                         |
| 3. Pull              | Elbows bend out, the head and shoulders rise past the hands; effort face                   | Hands stay planted (solved), elbows flare out and down, lift to about -0.33 (shoulders at the edge), brows down, squint, squash                                                                   |
| 4. Re-grip and press | Hands walk in under the shoulders, the arms lock straight and push the hips up to the edge | One hand then the other move in to ±0.06 BH; press to lift about -0.2 with straight arms (hips at the edge)                                                                                       |
| 5. Leg over          | One knee and foot come up onto the edge first (heel hook); the other is still hidden       | One foot target lifted onto the edge line while the other stays below the mask; shift the hips toward the hooked side                                                                             |
| 6. Mantle            | Weight rolls over the hooked leg into a crouch on top                                      | Lift to 0 in a crouch, hands still on the edge, then let go                                                                                                                                       |
| 7. Stand and brush   | Stand with overshoot; brush the hands                                                      | Existing brush-hands beat with alternating open palms                                                                                                                                             |

The **edge occludes the body**: everything below the edge line is clipped (`clipBelow`), the
hands are drawn on top of the edge, and there is no contact shadow until the feet are on top.
The head clears the edge first; the eyes lead. The hands and their contact are the story of
beats 1-4, so they are kept beside the head (never in front of the face) and swap poses on
contact.

### Sitting

- **Sitting down** has four keys: default, lean (chest forward, hips back over the seat), touch
  (first contact), straighten, with a small overshoot in the chest and head on contact
  ([Animation Mentor, sitting down](https://www.animationmentor.com/blog/tutorial-animate-characters-sitting-down/)).
  Standing up needs anticipation for the weight shift: lean forward, then push, with the upper
  body joining in ([LinkedIn Learning, seated to standing](https://www.lynda.com/Animation-tutorials/Animating-character-from-seated-standing-Creating-main-poses/134617/159437-4.html)).
- **Contacts:** floor sit = seat + both soles (+ hands beside the hips when propped). Ledge sit =
  seat on the edge (+ hands on the edge beside the hips); the legs hang free in front of the
  frame. Shadows: the floor sit's shadow spreads under the seat and feet; the ledge sit has a
  small shadow on the edge top and none on the floor.
- **Posture types** (_synthesised_ from the line-of-action and weight rules):

  | Posture                     | Line of action                    | Arms and hands                                                 | Legs                                        | Reads as          |
  | --------------------------- | --------------------------------- | -------------------------------------------------------------- | ------------------------------------------- | ----------------- |
  | Upright                     | Straight, head level              | Hands on the seat beside the hips (open, arms down and out)    | Ledge: hanging; floor: feet out             | Attentive, polite |
  | Relaxed slouch              | C-curve, torso back, head forward | Arms behind on the seat, propping (shoulders out and back)     | Ledge: one leg swinging                     | Chill, at home    |
  | Knees up, hugging           | Tight C, head down on the knees   | Forearms folded in across the shins (elbows in, arms in front) | Feet lifted close to the seat               | Cosy, shy         |
  | Cross-legged, chin in hands | Forward lean, head propped        | Elbows in, forearms up, fists under the chin, arms in front    | Feet tucked (both lifted, crossed in)       | Bored, watching   |
  | Dangling and kicking        | Upright, slight bounce            | Hands on the edge                                              | Alternating swings, sometimes a double kick | Playful           |

- **Dangling legs** swing like a pendulum; a lower leg about the knee at 0.6-0.9 s period
  (BODY-STATES-RESEARCH). Alternate the legs rather than twinning them; an occasional in-phase
  double kick is the accent.

### Lying down and napping

The readable sleep poses are the slumped sitting doze and a sloped side-lie with two contacts
(head and feet), solved by `solveLie` (BODY-STATES-RESEARCH). With elbows the lie improves: the
lower arm bends so the hand pillows the head, the upper arm drapes over the body, and the knees
draw up (both feet lifted and stacked). The shadow is a long ellipse under the body; the z's
leave the head on the up side.

### Leaning on a frame

Contrapposto: weight on the leg away from the wall, the hip pushed toward the wall, the shoulder
and the side of the head on the frame edge, the far foot crossed over the near ankle, and the
arms folded or one hand in a pocket position (_synthesised_ from Smarthistory and Stanchfield;
"parallel lower legs" is the classic error). On Tavi: rotate about the soles until the hair
touches (`solveLean`), shift the hips toward the edge, fold the near arm across (elbow bent in,
`armsFront` 0 so it tucks behind the hair), give the far arm a hand on the hip.

### Peeking around an edge

Lead with the head and eyes, then the fingertips curled on the edge, with the body hidden
behind the frame (Lasseter: the eye goes to the one thing that changes). Tavi peeks at the chat
panel from beside it: the near hand rests on the panel edge (open hand at the edge x), the torso
leans toward it, the head tilts with curiosity. A peek _from behind_ a frame (only the head and a
hand visible) needs a vertical clip mask, which the renderer does not have yet (see section 4).

### Dusting off the knees

No authoritative source exists for the gesture; this is acting reference (_synthesised_ from
Lasseter's silhouette staging and Stanchfield's counter-moves). Bend at the hips and knees (the
head drops and comes forward), look down at the knees, then pat with **open hands, alternating**,
elbows bent so the forearms come down to the thighs. Stage the pats to the sides of the body (in
silhouette), not across the chest. Each pat is a small accent with a tiny body bounce. Finish
with a look up and a straighten with a little shake. On v2: arms out and down (`armL/R` about
0.3-0.5), elbows folding in toward the knees, `handL/R` 1 (open) on the pats, the head down
(`gazeY`, `headY`), `bob` 0.04-0.06 with a hip shift toward the patting side.

### What reads at 176 px BH

| Element                      | Size at 720p            | Verdict                                         |
| ---------------------------- | ----------------------- | ----------------------------------------------- |
| Head height change of 0.1 BH | 18 px                   | Reads (sit, crouch, doze)                       |
| Whole-body rotation of 10°   | Head shifts about 20 px | Reads (lean, lie, peek)                         |
| Arm angled clear of the head | 29 px limb              | Reads if the arm is outside the head silhouette |
| Hand pose                    | About 6 px              | Reads only against a clear background or edge   |
| Elbow bend                   | Forearm 14 px           | Reads in silhouette, not in front of the body   |
| Feet and legs                | Legs about 30 px        | Read only when they are the silhouette (ledge)  |
| Face (eyes, brows)           | Eyes about 10 px        | Reads for blinks and big brow moves             |
| A 2 px contact error         | 0.011 BH                | Visible against a hard edge: tolerance 0.012 BH |

### Layering and compositing

- The overlay is above the scene, so "behind a frame" can only be faked by **masking** the part
  of the body inside the frame. Today the renderer supports one horizontal mask, `clipBelow`
  (everything below a line). That covers climbing up over a bottom edge, sinking behind an edge
  and sitting on a ledge with the lower legs in front.
- Wanted later (renderer request): a rectangle mask (`clipRect`, hide the body inside a scene
  rect) for peeking from behind the webcam or hanging behind the frame top.
- **Shadows per surface:** floor = the contact ellipse under the soles; ledge or top edge = a
  smaller, darker ellipse on the edge line; hanging from or climbing an edge = none; lying = a
  long flat ellipse. Shadows never draw on the scene below a ledge.
- **Draw order inside the body:** arms behind the hair by default; `armsFront` only for hands
  that must read in front (hands on an edge beside the face, chin in hands, hugging knees).
  Swap while the arm moves fast or at the moment of contact.

## 4. More interesting states

Surveyed from desktop-pet precedents (Shimeji's `SitAndDangleLegs`, `GrabCeiling`,
`HoldOntoIEWall`, `PullUp`, `Sprawl`; neko's sleep and frame scratching
([Wikipedia](<https://en.wikipedia.org/wiki/Neko_(software)>)); Desktop Goose; Bongo Cat's edge
perch) and streamer-companion fit. Feasibility on v2 today:

| Idea                                     | Read at 176 px                                                                                | Needs                                                                  | Feasible now                         |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------ |
| **Chin in hands** (sit, elbows on knees) | Strong: the face framed by two fists                                                          | Elbows, fists, `armsFront`; floor or ledge sit                         | **Yes**                              |
| **Hug knees** (sit, knees up)            | Strong: compact ball, head down                                                               | Feet lifted to the seat, forearms across the shins, `armsFront`        | **Yes**                              |
| **Cheer from the frame edge** (perch)    | Strong: fists up and pumping on top of the webcam                                             | Fists, elbows, perch                                                   | **Yes**                              |
| **Hang from the frame top** (from below) | Medium: hands can only reach eye height, so the head is between the arms and the body dangles | Hands on the edge (solved), the frame top above home within reach      | **Yes** (top edge within 0.5-1.2 BH) |
| Stretch (arms out, up on toes)           | Medium: the V-stretch with fists                                                              | Elbows straight, fists                                                 | Yes, as a fidget                     |
| Reading chat on a tiny phone             | Weak without a prop                                                                           | A held-prop attachment (attachments system)                            | Later (prop)                         |
| Waving from behind the frame             | Strong                                                                                        | A rectangle clip mask                                                  | Later (renderer)                     |
| Sleeping slumped against the frame       | Strong                                                                                        | Lean + doze composite                                                  | Later (chain)                        |
| Sitting on the chat box                  | Strong                                                                                        | A chat-top ledge spot (scene geometry already allows `chat` as a rect) | Later (spot resolution)              |
| Swinging from a frame corner             | Medium                                                                                        | Rotation about the hands (pendulum) and a corner spot                  | Later                                |

Chosen for this milestone: **chin in hands** and **hug knees** (sit posture variants, exposed as
their own states so the streamer can pick them), **cheer** (on the frame top) and **hang** (from
the webcam top). See `POSE-PIPELINE.md` for how they are built.

## 5. Posing rubric

Every key pose and every state passes these before it ships. Items marked **(auto)** are
measured by the pose pipeline's checks (`src/renderer/motion/pose/checks.ts`, run in tests and
shown live in the pose lab); the rest are judged in the pose lab and the screenshot strips.

1. **Line of action** — one readable C or S from the support to the head, pushed for the story;
   no zigzag. **(auto: no bend over 70° between successive spine segments; the lab draws it)**
2. **Balance** — the centre of mass is over the base of support when grounded (soles, seat,
   hands on an edge). **(auto: within the contact span + 0.05 BH)**
3. **Contacts** — every declared contact touches its surface: soles on the floor, seat on the
   edge, hands on top of the edge, hair on the wall. **(auto: within 0.012 BH, about 2 px)**
4. **Grounding** — no root translation while grounded, hips never rise above standing, feet do
   not slide during a hold. **(auto: grounding tests plus the beat check)**
5. **Silhouette** — limbs that carry the idea are clear of the head and torso mass; no twins
   (both arms identical). **(auto: hand separation from the body mass; mirrored-arms check)**
6. **Occlusion and framing** — the scene hides what it should (the body below the edge while
   climbing), nothing pokes through the wrong side of an edge, hands on an edge draw in front of
   the hair and never across the face. **(auto: draw-order check; clip line vs contacts)**
7. **Appeal** — asymmetry, tilt, straights against curves, a clear personality read.
8. **Readability at 176 px** — the overlay-size strip reads without the large one.
9. **Living hold** — the hold moves (breath, weight, eyes, the state's own life) without
   drifting off its contacts. **(auto: the hold varies, contacts stay within tolerance)**
10. **Transitions** — weight moves onto the new support before the old one lets go; no pops
    between beats; anticipation before big moves and settle after. **(auto: continuity between
    keys and beats, peak joint speed)**
