# Alternative avatar pipeline research

Research date: 2026-10-27. Branch: `experiment/avatar-3d`.

**Stopped by the user on 2026-10-27.** Continue the original 2D Tavi in Rive.
The stock 3D character and facial experiment did not meet the required visual
quality. Preserve these experiments as references; do not expand them or replace
the established landing-page character with them. The default homepage uses Rive.

## Implemented comparison

Open `/avatar-lab` on the development server (currently port 5174). The isolated
route loads KayKit Ranger and a Quaternius Superhero female base, plus each
family's own idle, walk and run/jog clips. Controls include front/left/right
facing, orbit/zoom, half-speed playback, pause and rest pose. Characters are
normalized to the same display height, not the same body proportions.

The official free downloads and shipped CC0 notices are recorded in
`public/credits/avatar-lab/README.md`. Only the selected models, textures and
motion files are imported into the runtime. The Quaternius clip adapter
compensates local rest rotations and hip displacement on matching named bones;
it preserves target limb offsets and scales. It is not a general retargeter.

The next iteration adds an automatic walking shuttle over a floor grid. Each
rig's in-place walk is sampled at 120 points to infer forward travel from low,
backwards-moving feet. Root travel uses the cumulative curve, with a short
acceleration/settle blend. Reversals follow stop, idle and turn states, and the
controller does not translate during its turn. It does not yet lock an IK foot
to a world-space contact target, so this is a contact-review prototype rather
than a guarantee of zero slip.

Running stays in place in this small scene. Quaternius's root-motion reference
for `Jog_Fwd_Loop` travels five source units per 0.93-second cycle, too far for a
single stride on the comparison floor. `tools/avatar-lab/import-assets.mjs`
extracts reference distances from the official root-motion GLB into
`quaternius/root-motion.json` so tests can compare calibration against the
author's intended motion instead of assuming a speed from the clip name.

Verified both models rendering, in-place motion and automatic walking travel in
Chrome. All 415 project tests, production build, targeted avatar-code lint and
skill verification passed after this iteration. OBS, mobile performance, precise world-space foot contact,
IK interaction targets, clothing simulation and hair physics remain unverified
or unimplemented. These comparison assets are not the final Tavi design.

## Recommendation

Start the experiment with an existing rigged character and animations from the
same asset family, rendered through the Three.js dependency already in Tavi.
This removes initial rig construction and most animation retargeting from the
first experiment. It is a technical comparison character, not approval of a new
Tavi design. Babylon.js is the next engine to evaluate if its integrated tools
save significant controller and retargeting work.

Changing engines alone will not fix bad skin weights, foot sliding, clothing
clipping or weak animation. Keep the asset pipeline separate from the runtime
choice, and verify both together in the browser and OBS.

## Character and motion options

| Option | What it makes easier | Remaining work / limitations |
| --- | --- | --- |
| KayKit character + matching animation sets | Shared rigs and ready-made idle, movement, sitting, lying and gesture clips. Good first locomotion test. | Stylized game character appearance; facial expression capabilities must be inspected in the selected asset. Custom rope/climb contacts still require work. |
| Quaternius Universal Base Characters + Universal Animation Library | Rigged humanoid bases, modular hair and a library including directional locomotion and sitting. | Confirm the chosen free/paid package contents. These proportions are not automatically Tavi's design; retargeting and contact cleanup may be needed. |
| Mesh2Motion | Local/open-source skeleton fitting, skinning and animation export for a supplied mesh. | Inspect deformation quality, fingers, clothing and expression support on the actual model. Auto-rigging is a starting point, not a polish guarantee. |
| Mixamo | Free Adobe-account workflow for humanoid auto-rigging and existing animation clips. | Adobe documents limitations with extreme proportions, large hair/clothes and unsuitable mesh structure. It is not a complete facial or garment-rig workflow. |
| AccuRIG | Guided humanoid rig fitting, including hand setup. | The free/advanced comparison lists separate limitations for skin editing, facial rigs and physics. Do not assume these come with the free rigger. |
| VRM + three-vrm | Established avatar runtime and humanoid format, useful when importing user avatars. | Model rights, facial channels, spring bones and motion compatibility depend on the particular model. VRoid's guidelines have a separate restriction on character-generation applications: review product fit before adopting its assets for Tavi's avatar creator. |

Sources:

- [KayKit Character Animations](https://kaylousberg.itch.io/kaykit-character-animations): author lists CC0 animation files and optional paid Blender source files; climbing is listed as planned, not a confirmed included action.
- [Quaternius Base Characters](https://quaternius.com/packs/universalbasecharacters.html) and [Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html): author lists humanoid rigs and CC0 packs. Preserve the license shipped with the exact downloaded files and verify which package contains the desired assets.
- [Mesh2Motion repository](https://github.com/Mesh2Motion/mesh2motion-app): MIT application, CC0 project art/rigs/animations. [Project news](https://mesh2motion.org/news) documents newer FBX export in addition to GLB; the README's format list may lag releases.
- [Adobe Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html).
- [AccuRIG free/advanced comparison](https://www.reallusion.com/auto-rig/accurig/).
- [three-vrm](https://github.com/pixiv/three-vrm), [VRoid guidelines](https://vroid.com/en/studio/guidelines).

## Runtime options

These assessments are engineering judgments based on the documentation, not
benchmark results for this project.

| Runtime | Tavi fit | Integration cost |
| --- | --- | --- |
| Three.js + optional Rapier | First choice for the prototype. Already renders the CRT; can place the avatar in the same scene for occlusion and contact. | Lowest initial change; animation/state orchestration and contact logic remain our responsibility. |
| Babylon.js + Havok | Strong browser-native alternative with integrated physics and documented animation retargeting tools. | New renderer and scene plumbing; benchmark the benefit against keeping Three.js. |
| Godot | Strong editor-driven option for a larger game-like companion world. | Separate engine/export pipeline and integration with React. Web exports use WebGL 2/Compatibility; Godot 4 C# does not currently export to web. Single-threaded export avoids cross-origin-isolation requirements but has its own performance tradeoff. |
| Spine / Live2D | Worth considering if preserving hand-drawn 2D artwork is the top constraint. | View-specific artwork and rig authoring remain substantial; this does not eliminate the construction problem behind our current turns. |

Sources: [Three.js animation system](https://threejs.org/manual/pages/animation-system.html),
[Rapier character controller](https://rapier.rs/docs/user_guides/javascript/character_controller/),
[Babylon animation retargeting](https://doc.babylonjs.com/features/featuresDeepDive/animation/animationRetargeting),
[Babylon Havok integration](https://doc.babylonjs.com/features/featuresDeepDive/physics/havokPlugin/),
[Godot web export](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html),
[Spine physics constraints](https://us.esotericsoftware.com/spine-physics-constraints),
[Live2D Web SDK](https://www.live2d.com/en/sdk/download/web/).

## First experiment and acceptance criteria

### Blender authoring checkpoint (2026-10-27)

The Microsoft Store Blender 5.2.3 LTS installation runs the import/export script
through its registered `blender-launcher.exe` alias. Direct invocation of the
protected package executable returned Access denied, including outside the sandbox.
`tools/avatar-lab/blender_setup.py` creates an editable Ranger scene and exports
`public/models/avatar-lab/kaykit/Tavi_Ranger.blend.glb` for `/avatar-lab`.
The runtime bundle contains the matching idle, walk and run clips plus an original
look-around study based on the relaxed idle pose. The Quaternius panel uses idle
when that KayKit-only study is selected. This is an import/author/export milestone,
not final Tavi artwork or a landing-page character replacement. IK authoring
controls, table contact and custom traversal remain future work.

Browser verification confirmed the export renders with relaxed arms. All 416
tests pass, including actual exported walking displacement and planted feet during
the look-around clip; targeted ESLint and skill verification pass.

### Remaining acceptance criteria

1. Load one existing rigged character and its matching idle/walk/sit clips in an
   isolated preview route. No migration of the current Studio or overlay yet.
2. Walk equal distances left and right, turn through intermediate headings,
   stop and return to idle. Root travel must match the stance foot; no whole-body
   squeezing, reversed playback masquerading as a forward walk, or teleporting.
3. Keep body, clothing and hair as separate responsibilities. Garments retain
   their identity; accessories follow their intended attachments. Verify contact
   and clipping from front, both three-quarter angles and side views.
4. Add a static table/TV test. Check front/behind occlusion, sitting alignment and
   a hand touching a fixed target before attempting the rope sequence.
5. Measure asset size, load time, frame timing and GPU/CPU impact in Chrome and
   an OBS Browser Source. Test resize, visibility changes and reduced motion.
6. Add bounded hair/garment secondary motion after the base animation is sound.
   Physics handles collision/response; authored motion and IK handle acting and
   deliberate hand/foot contacts. Full cloth simulation is not a first milestone.

The existing Twitch, AI, OBS layout and behavior services remain reusable. The
prototype should consume semantic actions rather than importing Rive track IDs.
No model purchase, new tool installation or replacement engine has been made as
part of this research. A final asset/runtime choice follows an actual comparison.
