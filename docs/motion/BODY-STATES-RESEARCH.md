# Body states research: sit, ledge, lean, perch, peek, nap

Shared research for the body-states, motion and character-design agents. It is written to drive
`shared/states.ts`, `src/renderer/motion/states/` and the server-side state triggers. Numbers
marked _heuristic_ are engineering choices, not sourced facts. Numbers marked _measured_ come from
rendering the real rig (method in "How the rig numbers were measured" at the end).

**Units.** `u` = artboard units of `lyla animation` (600 x 600). The renderer draws the artboard
at the body height, so **1 BH = 600 u** (the binding's `UNITS`). Node offsets are given as the
probe writes them (node space: `+y` = down, so `footL y -18` lifts the foot), and also as pose
channels where useful (`bob = body.y / 600`, `footLY = -foot.y / 600`).

## Summary of findings

1. **The deep states should be earned through chains, not picked at random.** Shimeji only
   reaches "dangle legs" and "lie down" through a sit first, and every hold is randomised
   (20-60 s). oneko shows a "tired" beat before sleeping and an "alert" beat before running.
   Tavi's quiet-time behaviour should be: stand → sit → doze (sitting) → lie down and sleep →
   wake with a stretch.
2. **Edges are surfaces.** Shimeji gates behaviours by the surface it touches (floor, wall,
   window top); oneko scratches at window edges; Desktop Mate sits on windows and moves to the
   taskbar when the window disappears. No overlay pet we found sits on a _webcam frame_: this is
   distinctive for Tavi.
3. **Rig reality (measured).** Tavi is extremely head-heavy: the head is **58% of the visible
   height** and **2.8x the torso width**. The visible character is 477 u tall (0.80 BH), with the
   sole 55 u above the artboard bottom. Consequences:
   - Floor sitting and crouches read through the head dropping (hips +130 u lowers the head by
     130 u, 27% of the visible height), not through the legs.
   - **Ledge sitting reads very well**: hips on the edge, feet lifted 18 u so the knees come
     towards the camera, legs over the frame front.
   - **Lying flat on the side floats.** The head's half-width (152 u) holds the torso about
     110 u (0.18 BH) off the floor at 88-90°. **At -72° about the hips, the head and the feet
     both touch the floor** and the pose is grounded. Use the sloped lie.
   - **The sitting doze (slumped, head lolled) is the most readable sleep pose** at stream size,
     on the floor, on a ledge and against a wall.
   - Arm rotation above about 1.6 rad hides the arms behind the head, so an overhead stretch is
     impossible; **a V-stretch at 1.4-1.6 rad reads clearly**.
   - **Splayed feet sink 26 u below the floor** (feet ±55 u at hips +130 u); the sit pose must
     lift the feet 26 u (or a silhouette test must catch it).
4. **Sleep breathing is regular, not slower.** Physiology says NREM breathing is "remarkably
   regular" and slightly faster and shallower, not slower; slowing it down is a stylistic
   choice. Make sleep breathing regular and a little deeper-looking than awake breathing, and
   make awake breathing irregular (Live2D-style incommensurate periods).
5. **Chat bursts must be measured against the channel's own baseline.** We found no standard
   messages-per-minute cutoff. Tools compare the rate with a moving baseline (EWMA) and require
   distinct chatters. Proposal: a burst is ≥ max(floor, 3x baseline) messages in 30 s from ≥ 3
   chatters, with a cooldown.
6. **Clippy is the cautionary tale.** It interrupted at bad moments, and its cautious "when to
   appear" model was replaced by a cruder one so it appeared more often. Ambient states (sit,
   nap) are cheap; travel (peek) is expensive. Keep travel rare and never during streamer focus.

## 1. References and what to borrow

| Reference                 | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Borrow                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Shimeji-ee                | Engine ticks every 40 ms ([Manager.java](https://github.com/gil/shimeji-ee/blob/master/src/com/group_finity/mascot/Manager.java)). Behaviours are gated by the touched surface (floor, wall, ceiling, window top/side/bottom) and picked by weighted `Frequency` (floor: StandUp 200, SitDown 200; window top: SitOnTheEdge 100). `SitWhileDanglingLegs` and `LieDown` have frequency 0, reachable only by `NextBehavior` chains from SitDown ([behaviors.xml](https://github.com/gil/shimeji-ee/blob/master/conf/behaviors.xml)). Sit and sprawl hold 500-1500 ticks (20-60 s); the dangle cycle is legs up 10, down 100-200, dangle loop 500-600, frames alternating 5/15 ticks; "WalkAndSit" walks, stands 20-40 ticks, looks around, then sits ([actions.xml](https://github.com/gil/shimeji-ee/blob/master/conf/actions.xml)). Ledge poses use a different image anchor (64,112 vs 64,128) so the body sits below the edge line. | Surface-gated weighted tables; deep states only via chains; randomised holds; a "look before you sit" beat; an explicit seat anchor per pose. |
| oneko.js                  | 100 ms frames; idles become eligible after about 1 s still, then 1/200 per frame (about 20 s); sleep = 0.8 s "tired" then a looping sleep; within 32 px of a window edge it scratches that wall; on cursor motion an "alert" frame (~0.6 s) precedes running ([oneko.js](https://raw.githubusercontent.com/adryd325/oneko.js/main/oneko.js)).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | A tired beat before sleep, an alert beat before moving, edge-specific idles.                                                                  |
| Desktop Goose             | Long wander periods between disruptive acts; configurable aggression; hold Esc to dismiss ([itch.io](https://samperson.itch.io/desktop-goose); wander-time setting per [user comments](https://samperson.itch.io/desktop-goose/comments?after=2267)).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | A streamer-tunable mischief knob and a guaranteed escape hatch (our quiet mode and tuck away).                                                |
| Bongo Cat (Steam)         | Sits above the taskbar and slaps on every input ([Destructoid](https://destructoid.com/the-best-thing-from-steam-next-fest-is-a-productivity-boosting-bongo-cat-with-unlockable-hats)). No documented sleep state.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 1:1 tiny acknowledgements are very legible: use them while peeking (a glance per message), not big moves.                                     |
| Live2D / VTube Studio     | Breath is a sum of sines with unequal cycles (angle X 6.53 s, Y 3.53 s, Z 5.53 s, body X 15.53 s, breath 3.23 s) ([Cubism Breath](https://docs.live2d.com/en/cubism-sdk-manual/breath/)); auto-blink 2.5 ± 2 s ([eyeblink](https://docs.live2d.com/en/cubism-sdk-manual/eyeblink-unity/)). VTS layers tracking over idle animation and always fades hand-offs ([wiki](https://github.com/DenchiSoft/VTubeStudio/wiki/Interaction-between-Animations,-Tracking,-Physics,-etc.)). No official AFK/sleep feature; streamers hotkey one.                                                                                                                                                                                                                                                                                                                                                                                                  | Incommensurate breath periods while awake; a strict priority stack where a higher layer releases parameters with a fade.                      |
| Tamagotchi                | Sleep is a scheduled, legible state the owner tends (lights off) ([Best Buy listing](https://bestbuy.ca/en-ca/product/the-original-tamagotchi-purple-pink-clock/16146851), [Wikipedia](https://en.wikipedia.org/wiki/Tamagotchi)).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Sleep should be obvious (z z z) so viewers understand "it's napping", and waking it is an interaction, not a glitch.                          |
| Animal Crossing, Stardew  | Villager sleep windows differ by personality (lazy about 23:00-08:00, normal 00:00-06:00, peppy 01:30-07:00: [Nookipedia](https://nookipedia.com/wiki/Lazy), [Normal](https://nookipedia.com/wiki/Normal), [Peppy](https://www.nookipedia.com/wiki/Peppy)); hobby idles such as reading ([Hobby](https://nookipedia.com/wiki/Hobby)). Stardew schedule entries are time, map, x/y, facing, animation ([Schedule data](https://stardewvalleywiki.com/Modding:Schedule_data)).                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Personality changes _when_ and _how long_, not just _which_ state. Model a state as a target: place, facing, pose.                            |
| Duolingo (Rive)           | Lily combines 8 head x 8 body idles (64+ variations) to avoid loops, leans in while listening and ponders during latency ([Rive blog](https://rive.app/blog/duolingo-s-ai-powered-video-call-brings-lily-to-life)); visemes run in parallel with body states ([Duolingo blog](https://blog.duolingo.com/world-character-visemes)).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Independent head and body idle layers within each state; expressions layer over a held body.                                                  |
| Desktop Mate (Steam)      | Drag a character onto a window and it sits on it; idle characters tuck to the screen edge ([Steam](https://store.steampowered.com/app/3301060/Desktop_Mate/)); left alone it "may end up lying down" ([GIGAZINE](https://gigazine.net/gsc_news/en/20250108-desktop-mate)); since 1.4.1 it no longer sits on maximised windows and moves to the taskbar ([SteamDB](https://steamdb.info/patchnotes/19322470)).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Sitting on UI frames is a proven delight; leave gracefully when the surface is removed (a scene rect is deleted or resized under Tavi).       |
| VPet, TwiPet, Spirit City | VPet: 200+ animations, touch reactions ([Steam](https://store.steampowered.com/app/1920960/VPet_Simulator/)). TwiPet (Twitch): needs decay in real time, chat cares for it, short animations loop several times "for chat visibility" ([itch.io](https://grifnmore.itch.io/twipet)). Spirit City: the character moves between desk, bed, window and beanbag by activity ([Boss Rush](https://bossrush.net/2024/05/spirit-city-lofi-sessions-boosts-productivity-and-mental-health/)).                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Repeat short reactions so stream viewers (with latency) still catch them; tie places to activities.                                           |
| Clippy                    | Interrupted with unsolicited help ([Mental Floss](https://www.mentalfloss.com/article/504767/tragic-life-clippy-worlds-most-hated-virtual-assistant)); Horvitz's Bayesian timing model was "deemed too cautious" and replaced by a cruder one ([LessWrong](https://lesswrong.com/posts/8Cdn7z7eM7CWs87Xm)); mixed-initiative principles: time actions to the user's attention, weigh costs ([Microsoft Research](https://www.microsoft.com/en-us/research/publication/principles-mixed-initiative-user-interfaces/)).                                                                                                                                                                                                                                                                                                                                                                                                                 | Initiative states must be rare and cheap, never during streamer focus, and always overridable.                                                |

## 2. Body mechanics

**Centre of mass and base of support.** The body is balanced when its centre of mass projects
inside the base of support (the feet when standing; feet + seat when sitting; the whole side when
lying). Every transition is a change of base: the animation must show the weight moving onto the
new support before the old one is released (Richard Williams: know where the weight is on every
drawing, [Faber](https://www.faber.co.uk/product/9780571358434-the-animators-survival-kit-flexibility-and-weight/)).
For Tavi, the centre of mass sits high, in the lower head (_heuristic_ from the measured
proportions), so placement rotation about the feet or hips sells weight far more than the tiny
limbs do.

**Sit to stand** has four phases (Schenkman 1990): flexion-momentum (trunk pitches forward to
build momentum, ending just before seat-off), momentum transfer (seat-off to maximal ankle
dorsiflexion), extension, stabilisation
([Frontiers 2021](https://www.frontiersin.org/journals/human-neuroscience/articles/10.3389/fnhum.2021.678302/pdf)).
The trunk flexion mainly generates forward momentum. Healthy young adults take 1.5-2.4 s, with
peak trunk flexion about 59 ± 18° near seat-off
([PMC8183776](https://pmc.ncbi.nlm.nih.gov/articles/PMC8183776),
[NITK](https://idr.nitk.ac.in/handle/123456789/20614)). **Stand to sit** is a slower, controlled
lowering whose first phase is longer and whose trunk flexion is larger
([UFMG](https://repositorio.ufmg.br/handle/1843/30055)).
Animation keys for sitting down: default, lean (hips start back towards the seat), touch (first
contact), straight, with a small overshoot and overlap in chest and head on contact
([Animation Mentor](https://www.animationmentor.com/blog/tutorial-animate-characters-sitting-down/)).
Standing needs anticipation for the large weight shift: lean back, then push forward, with the
upper body joining in
([LinkedIn Learning](https://www.lynda.com/Animation-tutorials/Animating-character-from-seated-standing-Adding-secondary-motion/134617/159438-4.html)).
Common faults: no anticipation, too fast for the mood, no ease, overshoot or settle
([critique](https://blenderartists.org/t/sit-to-stand-exercise/632215)).

**Rising from the floor.** Median 3.7 s (younger) to 5.7 s (older adults)
([U. Michigan](https://deepblue.lib.umich.edu/bitstream/2027.42/111270/1/j.1532-5415.2000.tb03874.x.pdf));
typical adult pattern: asymmetric squat, one hand leaving the floor first, slight trunk rotation
([Pacific U.](https://commons.pacificu.edu/works/publication-dissertation/8evd5-4x010)); kneeling
or half-kneeling is a common intermediate
([BMC Geriatrics](https://bmcgeriatr.biomedcentral.com/articles/10.1186/s12877-017-0618-x/tables/3),
[Harvard Health](https://www.health.harvard.edu/healthy-aging-and-longevity/rising-up-from-a-fall)).
_Heuristic_ split for a cartoon get-up of about 3 s: roll to side/prop 0.6 s, push up to sit 0.9 s,
sit to stand 1.1 s, settle 0.3 s. Lying down is the reverse, slower in the middle and softer at
the end.

**Contact points per state.** Standing: both soles. Floor sit: seat + both soles (splayed).
Ledge sit: seat on the edge (+ optional hands on the edge); feet free. Lean: soles + the head
(Tavi's head is the widest part, so it touches a vertical edge before the shoulder does). Perch:
soles on the top edge. Peek: soles; optional hand on the panel edge. Lie (sloped): head side and
feet. These contacts are what must stay locked during a hold.

**Breathing.** Resting adults 10-20/min (12-20 in most sources); children 1-10 years 14-50
([OpenTextBC](https://opentextbc.ca/vitalsignmeasurement/chapter/what-is-respiration/)). In NREM
sleep breathing is "remarkably regular" in rate and amplitude; REM is irregular
([Wikipedia: sleep and breathing](https://en.wikipedia.org/wiki/Sleep_and_breathing)); ventilation
drops slightly and breathing is faster and shallower
([Thorax 1982](https://thorax.bmj.com/content/37/11/840)). Exhale is longer than inhale at rest,
about 1:2 ([LibreTexts](<https://med.libretexts.org/Bookshelves/Medicine/Breathe_Easy%3A_RT_Student_Resource_for_Mechanical_Ventilation_(Drasovean)/01%3A_Chapter_1__How_the_Human_Body_Breathes_-_Physiology_of_Ventilation/1.04%3A_1.4_Ventilation>)).
Animators move belly, then chest, with shoulders a few frames later and arms trailing; exaggerate
for heavy breathing, dial back for idle
([AnimSchool](https://blog.animschool.edu/tag/animated-breathing/)). Decision for Tavi: **awake**
keeps the existing personality breath (cozy 4.6 s, playful 3.2 s, shy 3.9 s) with incommensurate
secondary sines; **asleep** uses a single regular period 1.15x the awake period (stylised, reads
as calm), inhale:exhale 40:60, and 1.6x the awake amplitude so it is visible at 220 px.

**Sleep postures readable in 2D.** Most adults sleep mostly on their side
([Sleep Foundation](https://www.sleepfoundation.org/sleeping-positions/meaning)). Readable options
for a front-facing chibi: (a) slumped sitting doze, head lolled to one side; (b) leaning against
a wall with the head resting on it; (c) sloped side-lie (head down, feet down); (d) curled side-lie.
Measured on our rig, (a) and (b) read best, (c) reads clearly, (d) is ambiguous at 220 px.
**Nodding off**: neck tone drops at sleep onset
([Borbély 2006](https://bmcneurosci.biomedcentral.com/articles/10.1186/1471-2202-7-2/figures/1)),
so the head sags, then snaps up; the snap can be a hypnic jerk (brief whole-body twitch at sleep
onset: [Wikipedia](https://en.wikipedia.org/wiki/Hypnic_jerk),
[AASM](https://sleepeducation.org/sleep-starts/)). REM twitches are brief, discrete, distal
movements ([Blumberg, PMC3823644](https://pmc.ncbi.nlm.nih.gov/articles/PMC3823644)).
**Conventions**: "Z" for snoring dates to the Katzenjammer Kids, 1903
([Mental Floss](https://www.mentalfloss.com/language/why-zzz-means-sleep)); manga uses a snot
bubble (hana-chōchin), origin unconfirmed
([Japanese with Anime](https://www.japanesewithanime.com/2020/03/snot-bubble.html)).
**Yawn**: about 6 s, a fixed action pattern that runs to completion once started; yawning with
stretching is pandiculation ([Wikipedia](https://en.wikipedia.org/wiki/Yawn),
[UW](https://faculty.washington.edu/chudler/yawning.html)). Never cut a yawn short.

**Dangling legs.** A whole leg swings like a pendulum at about 0.7 Hz (1.4 s)
([U. Toronto](https://www.physics.utoronto.ca/~jharlow/teaching/phy131f20/class31PreClass.pdf)); a
lower leg about the knee about 1.6 Hz (0.63 s)
([Vaia](https://vaia.com/en-us/textbooks/physics/college-physics-a-strategic-approach-4-edition/chapter-14/?page=3));
swinging at the natural frequency costs least
([SFU](https://www.sfu.ca/locomotionlab/assets/legswing2005.pdf)). For a child-sized shank
T ≈ 0.9 s (_heuristic_, T = 2π√(2L/3g)). Research ties leg swinging to restlessness and
self-regulation, not contentment
([UCF](https://sciences.ucf.edu/news/tag/joe-raiker/)), so "happy kicking" is an authoring
choice: use fast swings for playful/excited, slow lazy swings for cozy.

**Leaning.** Weight on one engaged leg makes the hip rise and the same-side shoulder drop: the
contrapposto S-curve reads relaxed and alive
([Getty](https://www.getty.edu/education/k-12-learning/strike-a-pose-exploring-contrapposto)).
Against a wall, contact is shoulder blade and pelvis with feet forward (_heuristic_); for Tavi it
is the side of the head and shoulder, with feet stepped 0.05-0.08 BH away from the edge.

**Chibi readability.** Chibi figures are 2-3 heads tall; the head anchors the design; use a clear
line of action (a C-curve reads relaxed and cute), keep limbs simple; eyes carry the expression
([Autodesk](https://origin-exchange.autodesk.com/chibi-art-style),
[Clip Studio](https://tips.clip-studio.com/de-de/articles/3448?org=1)). Tavi is about 1.7 heads
tall (head 58% of visible height, _measured_). At 220 px BH the visible character is about 175 px,
the head about 100 px, the legs about 30 px and the foot IK reach (0.08 BH) about 18 px.
Implications (_heuristic_, confirmed in the probe sheets): sell states through head height,
placement rotation and the head roll; push angles 1.5-2x realistic values; legs are a secondary
read except on a ledge, where they hang against the frame and become the key silhouette.

**Curiosity / peeking.** A sideways head tilt signals interest, more so with the head pushed
forward; leaning forward reads as engagement
([Wikipedia: body language](https://en.wikipedia.org/wiki/Body_language)). Reading eye movements:
fixations 200-250 ms (100 to over 500), saccades 20-40 ms jumping 7-9 characters, about 15%
regressions ([Wikipedia: eye movement in reading](https://en.wikipedia.org/wiki/Eye_movement_in_reading));
line-start fixations are longer and return sweeps undershoot with a small corrective saccade
([PMC6647890](https://pmc.ncbi.nlm.nih.gov/articles/PMC6647890)).

## 3. Transitions, layering, what varies and what is fixed

```text
            walk (locomotion)                       hop/climb (choreography)
 stand <--------------------------> stand@seat --------------------------> perch (on top edge)
   |  ^                                |  ^                                    |  ^
   v  |  sit-down / stand-up 1.3-1.6 s v  |                                    v  |  0.9 s
 sit-floor                          sit-ledge  <------------------------------------
   |  ^                                |  ^
   v  |  drowsy -> doze (sitting)      v  |  doze on ledge (never lies on a ledge)
 doze-floor                         doze-ledge
   |  ^   lie-down 2.4 s / get-up 3.0 s
   v  |
 lie -> sleep (z z z) -> wake (stretch) -> sit -> stand

 stand -> walk -> peek-at-chat (lean in) -> walk home      stand -> walk -> lean (edge)
```

Rules (_heuristic_):

- **Every transition is a choreography with a fixed duration, sampled from the cue start time**,
  so studio and overlay agree and a reconnect jumps to the held state (same contract as
  presence). Wake and get-up are the only transitions that may be shortened (urgent wake).
- **Walk → sit at a target**: arrive 0.05 BH short of the seat point, stop with settle, a 0.3-0.6 s
  "look at the spot" beat (Shimeji's stand-look-stand), turn to face front, then sit. Never sit
  while still sliding.
- **Ledges above the floor** need a hop or climb. Height gap ≤ 0.35 BH: a hop (existing gait).
  0.35-1.2 BH: a crouch-anticipated jump (crouch 0.25 s, launch stretch, 0.45 s arc, landing
  squash 0.2) or, for shy, the existing climb pull-up. Above 1.2 BH, or no floor beneath:
  the ledge is unreachable and the state falls back to sitting on the floor below it.
- **Lying down only from floor sit.** Never lie on a ledge or perch (no room, and falling off
  would read as a bug); doze sitting there instead.
- **Interruptions**: a manual cue or streamer reaction during a transition first finishes the
  current contact change (no hovering mid-air), up to 0.4 s, then reacts. Tuck away exits
  straight from the current pose (the exit choreography starts from wherever the body is,
  lying included: fade/slide).

**Expression layering per state** (each state declares the channel groups it owns, like
`ClipRequest.owns`):

| State        | Owns (fixed)                                         | Free for expressions                     | Full-body expressions (celebrate, big laugh bounce, startled hop)                  |
| ------------ | ---------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------- |
| sit floor    | hips y, feet, placement y                            | face, gaze, head, upper lean ±0.15, arms | Seated variant: arms + squash bounce + face; or stand first if priority ≥ streamer |
| sit ledge    | seat point (placement x/y), hips y                   | face, gaze, head, upper, arms, leg swing | Seated variant; kicking feet replaces hops                                         |
| lean         | feet, head contact with the edge, placement rotation | face, gaze, arms, small head roll        | Push off the edge to stand first                                                   |
| perch        | soles on the top edge                                | face, gaze, head, upper, arms            | Allowed small (bounce in place), never a hop                                       |
| peek         | feet, lean towards the panel                         | face, gaze (scan), head tilt, arms       | Un-lean 0.3 s first                                                                |
| doze / sleep | everything except face micro-motion                  | nothing                                  | Wake first (urgent wake 1.2 s), then perform                                       |

## 4. Behaviour design

### Principles

- Ambient states (sit, doze, sleep, lean) are low cost and fine to happen on their own.
  Travelling states (peek, perch on a high ledge) draw the eye and must be rare.
- Streamer first. Nothing initiative-driven starts while a streamer-priority script is active, a
  streamer decision is pending, or within 20 s of streamer input (_heuristic_). Without a
  microphone the service cannot sense game intensity; chat bursts are the only intensity signal,
  and they trigger peeks, never naps.
- Quiet mode suppresses initiative-driven state changes (no automatic sit, nap or peek starts);
  breathing and the current held state continue. Manual state buttons still work. Tuck away
  overrides everything and resumes `stand` on return.
- Decided-by stays honest: automatic states are labelled "Rules (not AI)". An AI provider may
  _request_ a state through the cue contract; the service validates and gates it.

### Chat burst (peek at chat)

No standard threshold exists; tools normalise against the channel's own baseline (Chat Decoder:
[case study](https://www.exmachinagroup.com/case-study/twitch-chat-decoder); EWMA with a deviation
threshold: [HdM Stuttgart](https://blog.mi.hdm-stuttgart.de/?p=7125); clip "several times
baseline": [Opus](https://www.opus.pro/mcp/inspiration/clip-the-moments-your-live-chat-exploded)).
Hype trains use "a few to 25 events in 5 min from several viewers" with about 1 h cooldown
(third-party: [StreamScheme](https://www.streamscheme.com/twitch-hype-train-complete-guide/)).

Proposal (_heuristic_):

- Count every chat message (addressed or not, excluding the streamer, known bots and `!commands`)
  in a sliding **30 s window**, plus distinct chatters.
- Baseline: EWMA of the per-30 s count with a 10-minute time constant, updated every 10 s.
- **Burst** when `count30 ≥ max(floor, 3 × baseline)` and `distinct ≥ 3`, where
  `floor = round(14 − 8 × chatEngagement / 100)` (default engagement 20 → 12 messages / 30 s).
- Initiative: reserved needs `2 × floor` and has a 15 min cooldown; occasional 6 min; outgoing
  `0.75 × floor` and 3 min. At most 6 peeks per hour.
- Peek lasts 15-30 s (seeded), extends while the burst continues, ends 8 s after the rate drops
  below half the threshold, maximum 45 s. Then walk home.
- While napping, a burst triggers an urgent wake and a "what did I miss?" peek. While sitting,
  Tavi stands up first.
- Simulated chat counts, and the studio note says "simulated".

### Quiet time (sit, doze, nap)

"Engagement" = streamer input (typed now, microphone later), a manual studio cue, an addressed
chat message, or a burst. Unaddressed single chat messages don't reset the timer, but any chat
rate above 1 message per 30 s blocks the doze and nap stages (Tavi stays awake while chat is
alive).

| Stage after the last engagement | Base                     | cozy | playful        | shy          |
| ------------------------------- | ------------------------ | ---- | -------------- | ------------ |
| settle (sit, lean or perch)     | 3 min                    | x0.7 | x1.4 (perches) | x1.0 (leans) |
| drowsy → doze (sitting)         | +6 min                   | x0.7 | x1.5           | x1.0         |
| lie down and sleep              | +3 min                   | yes  | no (dozes)     | no (dozes)   |
| self-wake and re-settle         | after 12-20 min of sleep | same | same           | same         |

Energy multiplies all quiet-time timers by `0.75 + 0.5 × energy / 100`. Initiative multiplies by
reserved 1.25, occasional 1, outgoing 0.85. Settling picks a spot by personality weights
(_heuristic_): cozy floor 0.6 / ledge 0.4; playful perch 0.5 / ledge 0.4 / floor 0.1; shy lean
0.5 / ledge 0.3 / floor 0.2; only spots whose scene rect exists and is reachable from home.

**Waking.** A manual cue or streamer input: urgent wake (1.2 s: eyes snap open with startled
brows, head up, stand) then react. Addressed chat or a burst: normal wake (about 4 s with
stretch and yawn) then react. One unaddressed chat message while asleep: a stir only (brow twitch,
head lifts 0.2 s, sinks back). Self-wake: full stretch and yawn. Personality: shy wakes with a
bigger startle and an embarrassed glance; playful bounces up; cozy is slow, with a long yawn.

### Manual states

Studio buttons: Stand, Sit, Nap, Peek at chat, Perch, Lean. Manual states hold until replaced
(peek: until the button is pressed again or 60 s). Nap from the studio goes through the full
chain quickly (sit 1.5 s → lie 2.4 s → sleep).

## 5. Feasibility on our rig

Controls: 15 joystick channels (`ctl.*`: faceX/Y, brows, blinks, lids, mouth X/Y/curve, squash,
3 hair), nodes `body` (hips: x/y offset; scale), `upper` (lean rotation), `head` (roll, y),
`arm-l`/`arm-r` (rotation), `foot-l`/`foot-r` (IK target x/y), plus host placement (position,
rotation about the feet, facing, scale, `clipBelow`).

| State          | How it is built                                                                                                                                                 | Reads now?                                                                   | Needs Rive authoring                                                                    |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| sit floor      | hips +130 u, feet ±55 u and **lifted 26 u** (splayed feet sink 26 u otherwise), squash +0.5, arms -0.2                                                          | Yes at large size; at 220 px it reads as a low "squat-sit" (head drop)       | A proper cross-legged or knees-up seated pose (`sit_floor`)                             |
| sit ledge      | placement so the seat line is 89 u above the sole (_measured_ 0.148 BH); hips +10, feet lifted 18 u (knees towards camera); arms ±0.35-0.45 (hands on the edge) | **Yes, very clearly**, at both sizes                                         | Thigh foreshortening and shin swing (`sit_ledge`, `swing_legs`)                         |
| lean           | placement rotation -9° about the feet towards the edge, hips x +25 u, feet x +30/+40 u, upper +0.12, head +0.1, near arm -0.2                                   | Moderately: reads as "leaning"; contact is the hair                          | Arms crossed, one ankle crossed over the other (`lean_wall`)                            |
| perch          | standing or crouched (hips +90 u, feet ±45 u) with the soles on the frame's top edge                                                                            | Yes (a bird-like crouch on top)                                              | None required                                                                           |
| peek           | hips +40, x +30 u; upper -0.38; head -0.3; placement +7° towards the panel; faceX +1, faceY -0.4, brows -0.7                                                    | **Yes**                                                                      | A hand on the panel edge (`hand_on_edge`)                                               |
| doze (sitting) | sit floor + head roll 0.38, head y +35 u, upper +0.14, blinks closed, faceY 0.9, mouthY 0.4, squash 0.7                                                         | **Yes, best sleep read**                                                     | Optional `nod_off` clip                                                                 |
| lie (sleep)    | **placement rotation -72° about the hips**, hips x -40 u, feet x -35/-50 u (stacked), ground offset solved so head and feet touch; eyes closed                  | Yes; flat (-88°) floats by 0.18 BH and is rejected                           | A real side-lying pose with the head on an arm and bent knees (`lie_side`), snot bubble |
| stretch        | arms ±1.5 rad (V), hips -22 u, squash -1.1, head 0.12, blinks closed, mouthY 1                                                                                  | Yes (V-stretch); overhead impossible (arms vanish behind the head above 1.6) | `stretch` with arms overhead, `yawn` with a big mouth                                   |
| kneel/prop     | hips +130, x -20; upper +0.35; placement -18°; supporting arm +0.9                                                                                              | As a transition frame, yes; as a hold, no                                    | `get_up` (roll, push, kneel, stand)                                                     |

**Hard limits.** No head pitch (only roll); no knees except through IK at 0.08 BH reach; no
hands; the arms are single rotations; the mouth is small at stream size; the face is
front-facing, so lying and leaning are "front view rotated" rather than true side views. The
`squash` joystick is about ±4-8%.

**Ground contact must be solved, not hand-tuned.** Each held pose stores contact points
(`seat`, `soleL`, `soleR`, `head`) in rest-pose space; the state layer computes placement so those
points sit on the floor or ledge line. Tests sample each held state and assert the lowest
silhouette points (and the seat for ledges) are within ±3 u of the line. The probe in
"How the rig numbers were measured" is the starting point for such a test.

### Rive authoring notes for the remix (in addition to `RESEARCH.md` "Authoring spec")

Name exactly as below; key bones only (no face keys) so expressions layer over them; author at
60 fps; mark contact frames in the clip description (`contact: seat@0.42s`).

- **Bones:** add `thigh_L/R` and `shin_L/R` with leg IK so knees can bend towards the camera
  (needed for seated foreshortening), `hand_L/R` with a `hand_*_target` IK, and a `pelvis` pivot
  at the seat contact (so the runtime can rotate about the seat).
- **Pose clips (one-frame or short loops, additive-friendly from rest):** `sit_floor` (knees up
  and together, hands on knees; seat contact on the floor line), `sit_ledge` (thighs forward and
  foreshortened, shins hanging, hands on the edge beside the hips; seat contact marked),
  `swing_legs` (loop 1.0 s, legs alternate, ±25° at the knee), `lean_wall_L` (shoulder and
  side of the head on a wall at screen-left, ankles crossed, arms folded), `perch_crouch`,
  `peek_lean` (one hand on a vertical edge at chest height), `lie_side` (side-lying, head
  resting on the lower arm, knees bent, the lower contact edge flat on the floor line),
  `sleep_breath` (loop 5 s, belly then shoulder, 2-3% torso scale), `nod_off` (2.5 s sag + 0.12 s
  snap).
- **Transitions:** `sit_down` (1.4 s: lean, touch at 0.8 s, settle), `stand_up` (1.2 s:
  lean forward, seat-off at 0.35 s, rise, settle), `lie_down` (2.4 s: hand to floor, side,
  head down last), `get_up` (3.0 s: roll, push on one arm, kneel, stand), `hop_up_ledge`,
  `hop_down_ledge`, `stretch` (2 s, arms overhead, up on toes), `yawn` (mouth wide, 2.5 s).
- **Extras:** a `zzz` artboard or nested component (three Zs, driven by a 0..1 number), a
  `snot_bubble` (0..1 inflate), and view-model numbers `sleepiness` (0..1, droops lids and head)
  and `swing` (0..1 leg swing amount).

## 6. Beat sheets

Timing is in seconds from the transition cue start. Hold behaviours run until the next transition.
Easing: "in" slow-in, "out" slow-out, "spring" uses the motion core spring (f, zeta from the
personality profile). Reduced motion: every transition becomes a 0.5 s crossfade between the two
key poses (no rotation sweep, no overshoot, no squash), holds keep blinks and 0.5x breathing.

### Sit on the floor (stand → sit 1.6 s; sit → stand 1.3 s)

| t         | Beat                                                                                                                                                                                                                                         |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.00-0.35 | Look at the spot: gazeY +0.4, head 0.05; tiny rise hips -8 u (anticipation); arms out 0.15                                                                                                                                                   |
| 0.35-1.05 | Lower: hips 0 → +130 u (in-out), feet spread 0 → ±55 u and lift 0 → 26 u in sync, upper +0.10 forward then back; head lags 0.08 s                                                                                                            |
| 1.05      | Seat contact: squash spike +0.6 decaying over 0.25 s; hips overshoot +8 u; hair squash 0.3                                                                                                                                                   |
| 1.05-1.60 | Settle: arms to -0.2 (hands in lap), upper to 0, one big exhale (squash 0.25 over 1 s)                                                                                                                                                       |
| Hold      | Breath (personality period, amplitude via squash 0.12 + hips ±2 u); upper sway ±0.04 rad over 7-12 s; fidgets every 8-20 s: knee bounce (feet x ±6 u, 3 cycles at 3 Hz), lean back on one arm (arm 0.35, upper -0.08) for 3-6 s, look around |
| Exit      | 0-0.3 lean forward upper +0.18, hips +5 u (load), arms forward 0.3; 0.3-0.9 rise hips → 0 (out), feet back; 0.9 hips -6 u overshoot, squash -0.3; 0.9-1.3 settle                                                                             |

Fixed: seat and soles on the floor line. Faces: content, sleepy, bored, soft-smile.

### Sit on a ledge (from perch standing on the edge: 1.4 s; leave by hop-down 0.9 s)

| t         | Beat                                                                                                                                                                                                                                                                          |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.00-0.30 | At the edge, look down over it: gazeY +0.6, upper +0.08                                                                                                                                                                                                                       |
| 0.30-0.90 | Lower: placement y moves from "sole on the edge" to "seat on the edge" (89 u down) with ease-in; feet lift 0 → 18 u and forward; arms to the edge 0.45                                                                                                                        |
| 0.90      | Seat contact: squash +0.4 over 0.2 s; legs swing forward once from the momentum (feet x ±14 u, damped over 1.2 s)                                                                                                                                                             |
| Hold      | Swing bouts 4-10 s then still 5-15 s; period cozy 1.3 s, shy 1.1 s, playful 0.9 s; amplitude feet x ±14 u, y ±8 u; legs in anti-phase, sometimes in phase; hands on the edge (arms ±0.35-0.45); look down into the webcam at the streamer every 15-40 s (gazeY +0.7, 1.5-3 s) |
| Exit      | 0-0.25 hands push (arms 0.45 → 0.7), hips -6 u; 0.25-0.7 drop to the floor below (gravity arc, feet extend); 0.7 landing squash 0.25, 0.2 s settle. Or reverse the sit to stand on the edge                                                                                   |

Fixed: seat point on the edge line (no sliding); feet always below the seat. Doze on a ledge:
head roll 0.3, head y +25 u, upper +0.1, swing stops.

### Lean against a frame edge (1.0 s in, 0.8 s out)

| t       | Beat                                                                                                                     |
| ------- | ------------------------------------------------------------------------------------------------------------------------ |
| 0-0.4   | Step to 0.06 BH from the edge, turn the shoulder to it; glance at the edge                                               |
| 0.4-0.9 | Tip: placement rotation 0 → -9° (towards the edge) about the feet (in), hips x +25 u, feet x +30/+40 u; head roll +0.1   |
| 0.9     | Contact (hair on the edge): tiny squash 0.15; hair squash 0.3                                                            |
| Hold    | Contrapposto shifts every 6-12 s (hips x ±8 u, upper ±0.04); arm swing small; gaze wanders, long glances at the streamer |
| Exit    | Push with the near arm (0.3 s, rotation -10° then up), return to 0° with spring overshoot 1.5°, step away                |

### Perch on top of the webcam frame (hop or climb up; 0.9 s crouch-in)

Arrive by the reachability rules, land with a squash on the top edge, then crouch hips +90 u, feet
±45 u. Hold: breathing; peer over the front edge (upper +0.15, gazeY +0.8) every 10-25 s; looks
towards chat; playful bounces on the heels (hips ±10 u, 2 Hz, 2-3 bounces). Perch can become
"sit on a ledge" by the ledge transition. Exit: stand (0.4 s) then hop down. Shadow on the frame
top, not the floor.

### Peek at chat (walk over; lean in 0.6 s; hold 15-45 s; lean out 0.4 s)

| t     | Beat                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Walk  | Walk to beside the chat rect (the side facing Tavi's home), stop 0.08 BH from its edge, facing the panel; eyes lead (gaze at panel 0.3 s before arrival)                                                                                                                                                                                                                                                                                            |
| 0-0.6 | Lean in: placement +7° towards the panel, upper -0.38, head -0.3, hips +40 u and x +30 u; faceX +1, faceY -0.4; brows -0.7 (interest)                                                                                                                                                                                                                                                                                                               |
| Hold  | Reading scan: fixate newest (bottom of the chat rect) 300 ms, then 2-4 fixations stepping up (220 ms ± 70, saccade 30 ms, faceY steps -0.1), 15% regressions, return sweep to the bottom with a small correction. New message: glance to the bottom within 150 ms. Every 6-10 s glance back at the streamer for 0.6 s. Reactions (rules): laughs/"LUL" bursts → amused/laugh with squash pulses; hype → excited; repeated question marks → confused |
| Exit  | Small nod ("got it"), lean out 0.4 s, turn, walk home                                                                                                                                                                                                                                                                                                                                                                                               |

### Nap (from sit on the floor)

| Stage       | Beats                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Drowsy      | 30-90 s. Blinks slow (close 0.3 s, closed 0.4 s), lids half (squint 0.4); one full yawn (sleepy, about 6 s, never interrupted); 2-4 nod-offs: head sags (roll 0 → 0.3, y 0 → +30 u, faceY → 0.8) over 1.5-3 s then snaps back in 0.12 s; the first snap may be a hypnic jerk (whole body squash -0.3 for 0.15 s)                                                                                                             |
| Doze        | Slumped: head roll 0.38, head y +35 u, upper +0.14, blinks closed, faceY 0.9, mouthY 0.4, squash 0.7. Sleep breathing starts                                                                                                                                                                                                                                                                                                 |
| Lie down    | 2.4 s. 0-0.6 lean and put a hand down (upper +0.35, placement -18° about the hips, arm +0.9); 0.6-1.8 roll onto the side: placement -18° → -72° about the hips (in-out), feet stack (x -35/-50 u), head lands last; 1.8 head contact: hair squash 0.3, squash 0.3 for 0.15 s; 1.8-2.4 settle: wiggle hips x ±6 u twice                                                                                                       |
| Sleep hold  | Regular breath (period 1.15x awake, inhale 40%/exhale 60%, squash amplitude 0.25, hips ±3 u, hair squash lagging 0.15 s). A "z" on every second exhale: spawns near the head, drifts up and away 0.35 BH over 2.5 s, scale 0.6 → 1.0, fades; at most 3 visible. Twitch every 20-60 s (foot flick 0.15 s, brow twitch, or a mouth murmur mouthY 0.3 for 0.4 s). Every 3-6 min a resettle (sigh: one deep breath, hips wiggle) |
| Wake        | About 4 s. 0-0.4 eyes flutter (two partial blinks); 0.4-1.6 push up: -72° → -18° → 0 with effort (upper +0.35, supporting arm +0.9, a pause at the kneel/prop pose 0.2 s); 1.6-2.2 sitting, a little head shake; 2.2-3.2 stretch: arms ±1.5, hips -22 u, squash -1.1, eyes closed, mouthY 1 (yawn), hold 0.6 s, release with a shiver; 3.2-4.4 stand up (sit exit)                                                           |
| Urgent wake | 1.2 s: eyes snap open, brows startled, head up 0.12 s, skip the stretch, stand up fast (0.8 s), then the cue plays                                                                                                                                                                                                                                                                                                           |

Reduced motion for nap: the doze is the sleep pose (no lie-down rotation), a single static "z"
fades in and out with each breath, no twitches, no nod-off snaps.

## 7. Build order and acceptance criteria

1. **Sit on the webcam ledge + floor sit** (shared contact solver, stand ↔ sit, ledge geometry).
   Accept: on a ledge the seat is within ±3 u of the edge line in every held frame and the feet are
   below it; on the floor no silhouette pixel is more than 3 u below the line and the seat touches
   it; transitions show the weight landing (squash on contact); at 220 px the ledge pose reads as
   sitting in a screenshot review; reconnect mid-transition shows the correct sampled pose.
2. **Peek at chat** (walk, lean, scan, burst trigger). Accept: a simulated burst at the default
   settings triggers exactly one peek, a sub-threshold rate does not, cooldowns hold, quiet mode
   blocks it, a streamer cue cancels it; feet stay planted while leaning.
3. **Doze and nap** (drowsy, doze, lie, sleep, wake, stir). Accept: idle simulations at each
   personality reach sit/doze/sleep at the tabled times; any engagement wakes with the correct
   wake kind; in the lie the head and feet contacts are on the floor (±3 u) and no part of the torso
   floats more than 0.05 BH; breathing is visible but z z z never overlaps the webcam rect's
   interior by more than its margin.
4. **Perch** (reachability, hop up/down). Accept: unreachable ledges fall back; landing has a
   squash and no foot below the top edge.
5. **Lean**. Accept: the head contact touches the edge (±3 u) and the feet stay on the floor.

## Decisions for the user

1. **Idle without a microphone.** Today streamer input is only typed lines. Proposed: quiet time
   counts from the last studio action, typed line, addressed chat or burst. Alternative: no
   automatic naps until the microphone exists.
2. **Lie pose:** sloped (-72°, grounded) instead of flat on the side (floats on this rig). Proposed:
   sloped now, flat later with an authored `lie_side`.
3. **Automatic lying down only for cozy**; playful and shy doze sitting. The studio Nap button
   always lies down.
4. **Thresholds and timings** above: burst floor 12 messages / 30 s at default engagement, 3x
   baseline, ≥ 3 chatters, cooldowns 3 / 6 / 15 min; sit after 3 min, doze +6 min, lie +3 min;
   self-wake after 12-20 min.
5. **Ledge reach:** jumps up to 1.2 BH allowed (above that, sit on the floor below).
6. **z z z rendering:** a renderer particle (preferred) or a caption bubble.

## How the rig numbers were measured

`tools/motion-lab/probe.html` renders the patched rig with set channels and node offsets. A
scratch Playwright script (kept out of git) applied each pose, added a CSS transform on the canvas
for whole-character rotation and drew floor and frame rectangles behind it. Silhouette numbers
come from scanning the screenshot for non-background pixels (rest: top 68 u, sole 545 u, maximum
width 305 u at y 248; torso 107-162 u wide; legs 60 u). Re-measure after the Rive remix.
