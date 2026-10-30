# Tavi expressive 2D workspace

This is a separate authoring workspace. It does not replace the original source,
the Studio character, or the landing-page character. `fallback/` stores the exact
source/runtime asset at the start of this work, with SHA-256 hashes.

Rebuild with `python tools/tavi-rive-lab/build.py`. Preview with
`rive art/tavi-rive-lab/project`. The review cycles through neutral, joy, surprise,
concern, focus, sleepy and playful. Each endpoint also has a deterministic
close-up project under `poses/`, for example:

```
rive art/tavi-rive-lab/poses/joy --screenshot --advance=10
```

For interactive review, run `rive art/tavi-rive-lab/interactive`. The first row
selects neutral, joy, surprise, concern, focus, sleepy and playful, left to right.
The second row selects 35%, 65% and 100% expression intensity. Inputs are named
`expression` (0–6) and `strength` (0–100). The state machine blends complete,
held pose endpoints and eases state changes over 260 ms. Mouth artwork selection
remains discrete rather than interpolating incompatible mouth silhouettes.

The three controls above the character select left, front and right. Direction
changes play authored 600 ms turns (900 ms across both sides) through the front
view. Feet stay planted; no walk cycle plays during this rig review. Expressions
remain selectable in any view. `directions/left`, `directions/front` and
`directions/right` provide deterministic full-body endpoint captures.

The isolated body turn projects garment paths rather than scaling the leg
parent. Shirt and skirt overlap at the waist, skirt panels share a seam, and
shoulder roots stay behind clothing. The active shirt and skirt use uniform
fills, without the former side shading that produced a vertical center line.

The active top is now a single continuous weighted path. Its two shoulder
anchors follow the arm-root positions; its lower three vertices are weighted
100% to the waist, whose target is on the hip/body. The entire neckline rim
and both handles of each rim vertex are 100% weighted to the independent
neck-base anchor. Shoulder influence begins outside that rim. That same
neck-base anchor owns the lower neck
skin, keeping the opening and the neck aligned. Cubic handles carry the same
weights as their vertices.

The row just above the expression controls tests shoulder attachments: rest,
raise left, raise right, raise both. These can be combined with any direction.
The neck is also skinned between a head anchor and the collar, so the upper
and lower connections follow their owners rather than leaving a static neck
under a turning face. The head and collar anchors share one vertical center
line during yaw: the face turns around it instead of pulling the neck sideways.
Shoes, socks and trim share one foot-target attachment.

The skirt's upper waist boundary shares the shirt hem's waist bone and bind
curve, with a small concealed overlap. Its upper vertices no longer have
independent turn keys, so the two garment edges cannot drift apart during yaw.

The active skirt is a single continuous path, fitted over the original visible
pelvis and hip-start strokes. Its waist follows the shared waist bone and its
lower contour follows the pelvis without individual thigh pulls. This preserves
the central geometric design through ordinary motions. The old split panels are
retained but hidden. The original body is not hidden to disguise coverage errors.

The full neck-to-shoulder ridge now includes intermediate points and spatially
graded handle weights, so shoulder lifting bends that entire fabric edge.
The neckline-facing handles remain neck controlled.

During yaw the far shoulder moves inward by 6 units, retaining room between
the shoulder and fixed neck opening even with both shoulders raised. Shoulder
caps have continuous tangents rather than a corner. Far-arm draw targets sit
behind the skirt; near-arm targets stay behind the shirt and ahead of the skirt.
The direction layer switches these targets as the character turns through front.

The crown, fringe and rear hair share yaw travel and taper. Independent distance
slack is disabled for those attachments, rear locks use mirrored contours, and
the fringe halves keep their overlap within a common transform. Original hair
colors, crown gradient and swing controls are retained.
Hair mass recedes opposite the skull's turn lead, reducing visible hair on the
facing side and revealing more volume on the opposite side. Left/right poses
use the same magnitude with reversed signs; the front pose remains centered.

Elbows and knees retain the original two-bone chains and bone lengths. Limb
surfaces now use four weighted points: rigid upper/lower segments connected by
an 8u elbow / 10u knee rounding region, rather than a long rubbery curve. Each
point and its handles belong fully to its segment's bone; stroke widths stay
unchanged. Leg IK continues to solve against the existing foot targets.
The skirt keeps its fitted silhouette while its waistband remains attached to
the waist. Sock cuffs follow the shin angle and blend back into the planted
foot frame. The rounded shoe opening follows that same ankle frame, while its
toe, heel and sole belong to the foot frame. Foot targets own both position
and orientation; planted controls use zero rotation. Concealed leg skin ends
inside the cuff so its round end cap cannot poke through the shoe opening.

The new row at y=552 tests joints: rest (x=72), elbows (224), knees (376), both
(528). These controls blend in 450ms and combine with direction, expression,
and shoulder controls. The knee pose lowers the pelvis by 24u while both foot
targets stay planted; it does not stretch the legs or scale the body.
Lace strokes share the shoe-opening ankle attachment. Socks fully wrap the
lower leg with a 28u cuff and tuck inside compact, rounded sneakers.
`python tools/tavi-rive-lab/check_joints.py` checks native left/right captures
for visible bend changes with unchanged ground-contact heights. Upper shoe
pixels can change as the opening bends while the soles stay planted. Walking
uses the separate experiment below rather than these static attachment tests.

### Walking experiment

Open `rive art/tavi-rive-lab/walking` for the walking-only preview.
It turns, walks six steps right, settles, turns, walks back left, and returns
to front. The loop returns on foot rather than teleporting across its boundary.
The rig-review project and original fallback remain separate.

Stance foot targets are locked in world space. Swing targets use eased travel,
18u lift and ankle roll; body travel accelerates and decelerates independently
while local foot targets compensate for that actual travel. Pelvis bob and arm
counter-swing layer over the same two-bone rig and weighted clothing. No limb
lengths or whole-body scales are animated. The preview runs at 60fps with
per-frame contacts and knee controls; this pass is for motion review.

Near forearms have a separate foreground depth portion driven by the same
arm bones, while their shoulder and upper-arm attachment stay under the shirt.
This prevents a near forearm being cut away as if it passed behind the torso.
The walking near arm also has a small outward clearance that eases in/out
with the gait. Far arms retain garment occlusion, and both depth portions
follow the original skin palette animations.

`python tools/tavi-rive-lab/check_walk.py` reads the emitted animation, checks
stance drift, swing direction, foot reach and exact loop closure.

### Sprint and bounding skip

`rive art/tavi-rive-lab/locomotion` is the combined motion review. Its top
buttons select WALK, SPRINT or SKIP. A selection takes effect at the end of the
current out-and-back loop, when Tavi reaches the shared front-facing resting
pose. Skip is the current default for review. The walking-only copy is retained.

Sprint covers 312u in six alternating strides per trip, using short planted
support phases, airborne recovery, a forward lean, and bent-arm drive. Elbow
signs account for each arm's mirrored frame so both hands face travel.

Skip covers 320u in four 80u step-hop bounds per trip. A 52u forward step is
followed by a 28u forward hop on that same foot; the next stride switches sides.
The leap has a 42u vertical arc. Elbows sit below the shoulders and the
outstretched forearms angle gently up; palms open and head pitch lifts slightly.
The trailing foot settles into the resting stance before changing modes.

These are authored motion experiments on the original bone lengths. No original
physical leg bone scale or length is animated; isolated render helpers express
foreshortening. `python tools/tavi-rive-lab/check_gaits.py` checks
the emitted clips for contact drift, hip-to-foot reach, airborne phases,
forward sprint hands, skip arm direction, and loop closure in both directions.

Walking has its own low-recovery knee solution: knees follow their ankles,
and both calves share a gentle lean inside the original thigh reach limits.
This prevents an X as the swing foot passes the planted foot. Foot contacts,
step order and travel are unchanged in both directions. `check_walk_calves.py`
checks the emitted calf paths at every walking frame in both review projects.
Use `python tools/tavi-rive-lab/preview-climbing.py walking` for walking alone.

Sprinting and skipping use separate projected knee controls to
retain high knee lifts while reducing forward/outward protrusion. The original
skirt length, foot travel, step order, support timing and overall stride travel
are preserved. Both projected segments stay within their original lengths;
calves connect to the same shoe targets at every frame. These helpers do not
alter the original physical bones or the separate joint/sitting reviews.
`check_motion_legs.py` verifies reach and ankle attachment; the gait checks also
compare both feet's emitted paths against their intended step order.
`check_motion_coverage.py` renders highlighted native fixtures at climbing,
walk and skip contact/flight samples in both directions. These samples passed
with the original 74u hem and tucked-knee controls; they are not a claim about
every future pose or costume.

`python tools/tavi-rive-lab/check_coverage.py` renders a temporary native fixture
with the original underlying lower body highlighted. It checks five turn samples
with both shoulders raised for exposed pixels above the skirt hem, and verifies
the highlighted lower legs as a positive control. Requires Pillow; generated
fixtures/captures stay under `build/` and do not affect the live character.

### Seated lap coverage

The perch projects (`seating`, `seating-left`, `seating-right`) use a copied
skirt with a waist/pelvis-bound lap corrective. The forward rim encloses the
raised knee, the upper lap curve covers the hip attachment, and the hem extends
past the retained pelvis. The side contours mirror each other. Walking, sprint,
and skip retain the central waist/pelvis-bound contour; seated corrections are
installed only after copying the board.

`python tools/tavi-rive-lab/check_seated_coverage.py` highlights the underlying
body, legs, and socks in temporary native fixtures. Both held side views must
show no exposed highlighted geometry above the seated hem (one edge pixel of
antialiasing is tolerated), while highlighted cuffs below it prove the fixture
rendered. The check also samples sitting and standing transitions; the lap
follows the forward knee arc during both. Use native `seating-left` and
`seating-right` previews to review the full sit/stand transition and arm overlap.

### Climbing up and down

`climbing-front`, `climbing-left`, and `climbing-right` are isolated native
reviews of the rig's neutral and three-quarter views. Each repeats: establish
grips, climb four 36u steps, hold, descend, release, and settle. The static rope
ladder is review geometry. Hands alternate with the opposite foot; supporting
contacts remain fixed while the root travels. Quintic endpoint easing softens
release and landing. Gaze anticipates ascent/descent, and copied forearm depth
rules keep the raised hands readable beside the hair. Climbing-only leg controls
project a constant-length Y/Z knee bend toward the surface. Front/rear knees
stay in their hip columns; side views show a restrained forward bend. Render
foreshortening lives on isolated helper bones, with ankle/cuff constraints
following the same projected shin. The original physical bones stay unchanged.
The skirt retains its fitted rest contour throughout, without an apron morph.

Each project also contains reusable `tavi/climb/up/<view>` and
`tavi/climb/down/<view>` clips: 240 frames at 60 fps, root Y starting at zero
and ending at -144u / +144u. They begin/end in the gripping pose; the review
contains the grip/release transitions. Motion integration must offset the root
to the actual surface and provide matching contacts. These clips are for review
and are not yet connected to the homepage rope or live overlay.
"Front" means the existing neutral view. `climbing-rear` adds a dedicated
rear-facing climbing view with a continuous back-hair base and the original
layered locks and gradient texture,
suppressed front head artwork, a shallow back neckline, and heel views without
front laces. Arms pass on the surface side of the back hair instead of drawing
over it. It retains the same bones, contact paths, and original limb lengths.
This rear view remains isolated; there is no automatic turn integrated with
climbing or rear walking mode yet. The separate `turnaround` authoring draft
explores front/side/rear poses with curved facial occlusion, a continuous crown,
and stable garments. It needs artistic review before integration.

Run `python tools/tavi-rive-lab/preview-climbing.py` to open all four native
previews (including rear). Add `rear` to the preview command to open only that
view. Run `python tools/tavi-rive-lab/check_climbing.py` to check emitted
hand/foot contacts in both travel directions, leg reach, original limb lengths,
independent action displacement, and review loop closure. Native captures live
under `build/climbing-*-refined.png`.

Before expression integration, preserve ownership: motion controls root travel,
knees, contacts, and garment attachment; orientation controls front/rear artwork
and occlusion; facial clips control facial channels. Expressions must not reset
the body pose or expose front-facing features while the rear view is active.

`python tools/tavi-rive-lab/check_skirt_design.py` checks consistent geometric
contours and waist/pelvis ownership across ordinary motions. The design contract
is in `docs/character/GARMENT-SILHOUETTE.md`. `check_turnaround.py` checks the
isolated turn draft's mirrored visibility, stable crown, and loop closure.

Use `--advance=10` for deterministic captures: the joystick-driven eye/eyelid
constraints need to settle before a screenshot. `joy-left` and `joy-right` under
`poses/` test attachment and readability at both three-quarter views.

The original 2D Tavi artwork and skeleton are retained, with small eye whites
and pupil-attached highlights added in this workspace for readability beneath
the glasses. The new project removes unused customization UI bindings and
repairs empty draw targets; both native verify and inspect report no problems.
First milestone:
readable authored facial endpoints and neutral-relative expression tracks.
Gaze, blink and locomotion property ownership must be separated before these
tracks are layered over movement. These poses are candidates for visual review,
not an assertion that the requested quality is complete.

See `docs/character/DUOLINGO-RIVE-REFERENCES.md` for the authoring research.
No third-party example artwork has been copied into this workspace.
