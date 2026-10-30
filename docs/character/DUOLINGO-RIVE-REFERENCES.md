# Expressive 2D Rive references for Tavi

Research checked 2026-10-27. These are authoring and implementation references,
not a recommendation to change engines or replace Tavi with another character.

## What Duolingo actually uses

[Duolingo's own animation article](https://blog.duolingo.com/world-character-visemes/)
describes Rive state machines combining character animation with independently
controlled mouth shapes. Audio phoneme timings are mapped to authored visemes;
the app can interrupt speech and return to idle or a reaction. The article is a
production explanation, not a downloadable, licensed source rig or an automatic
expression generator.

[Rive's Lily case study](https://rive.app/blog/duolingo-s-ai-powered-video-call-brings-lily-to-life)
describes independent head/body movement, layered facial pieces, and modular
motion. Eight head animations and eight body animations produce 64 neutral
combinations. This is evidence that Rive supports the required architecture;
it does not show that blending alone supplies good expression artwork.

The [official character design guide](https://design.duolingo.com/illustration/characters)
is the useful visual reference: readable pupils and lids, asymmetric mouths,
simple hair masses, concealed arm sockets, and poses with a clear silhouette.
Its nose examples explicitly distinguish front, three-quarter and profile art.
Study these principles while retaining Tavi's identity; no reusable asset license
was verified for Duolingo's own characters.

## Ranked editable references

1. **Facial pose blending:** [Facial Expression Demo by JcToon](https://rive.app/marketplace/669-1300-facial-expression-demo/).
   The author describes additive expressions relative to Neutral, adjustable
   strengths, combinations, and an additional animation past the ordinary range.
   The listing exposes Download/Remix and links **CC BY 4.0**. Best reference for
   inspecting how authored facial poses blend without disturbing a neutral rig.
   Distinct source poses must still be designed for Tavi.
2. **Turn construction:** [Character turn animation by marvin.te](https://rive.app/marketplace/19598-36877-character-turn-animation/).
   The author describes nested bones and blending from quarter to side view.
   Download/Remix and **CC BY 4.0** are shown. Inspect as a turning technique;
   its listing does not establish correct Tavi clothing, volume preservation or
   bidirectional foot contact.
3. **Target-aware acting:** [Rive's Animated login screen design](https://rive.app/blog/animated-login-screen-design)
   and its [editable JcToon Teddy source](https://rive.app/community/files/2244-4437-animated-login-screen/).
   The tutorial explains a shared look target, different translation strengths
   for facial features, a distance limit, separate gaze/body layers, anticipation,
   and transitions returning to idle. The source listing identifies **CC BY**.
   This is directly relevant to Tavi looking at interface components; it is not
   a walking or full-body turnaround reference.

For the first two files, the listing's license link resolves to the
[CC BY 4.0 deed](https://creativecommons.org/licenses/by/4.0/). If remixing their
content, preserve author credit, source/license links and modification notices.
No reference files were downloaded or imported during this research.

## Runtime code versus artwork

[Rive's React repository](https://github.com/rive-app/rive-react) supplies runtime
examples and is [MIT licensed](https://github.com/rive-app/rive-react/blob/main/LICENSE).
That code license does not grant rights to unrelated character artwork. Tavi
already has a runtime adapter; a new package is not needed to adopt the authoring
techniques above. The official [use-cases repository](https://github.com/rive-app/rive-use-cases)
also exposes avatar and hero integration examples, but no repository-wide license
was visible in the inspected root, so do not assume its files are MIT.

## Concrete application to Tavi (engineering recommendation)

1. Establish a small static expression sheet on the existing Tavi face: neutral,
   warm joy, surprise, concern, focused attention and sleepy. Each must read at
   the actual website size with eyes, brows and mouth together, before animation.
2. Author front and both three-quarter views for body, garments and hair. Use
   intentional path deformation or replacement artwork where a turn changes
   visible contours; do not substitute whole-limb squeezing for missing views.
3. Separate view/orientation, gaze/blink, expression, body acting and locomotion
   responsibilities. Define property ownership so one layer cannot reset another.
4. Add a restrained neutral-relative blend only after endpoint poses read clearly.
   Keep high-intensity mouth/eye replacements discrete when interpolation breaks
   their design. Viseme poses are a separate speech requirement, not a substitute
   for joy, concern or surprise.
5. Preview deterministic left/right walks and start/stop/turn samples in Rive,
   then test gaze and expressions during those motions. Approve contact,
   silhouette, clothing identity and readable acting visually as well as in tests.

The practical next reference to inspect is JcToon's facial-expression source,
followed by the turn source. No Spine purchase or alternative engine is needed.
