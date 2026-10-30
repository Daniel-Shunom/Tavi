# Avatar comparison assets

Downloaded from the authors' official itch.io free download pages on 2026-10-27.
The original CC0 license notices are preserved alongside this file.

- Kay Lousberg, [KayKit Adventurers 2.0 FREE](https://kaylousberg.itch.io/kaykit-adventurers): Ranger and Mage, plus matching General and MovementBasic animation files. Files copied unchanged.
- Quaternius, [Universal Base Characters Standard](https://quaternius.itch.io/universal-base-characters): female and male Superhero base models and their referenced textures. The pack's missing `T_Eye_Normal_png.png` reference is supplied using its included `T_Eye_Normal.png` image under the referenced filename. glTF JSON is compacted; geometry, skeleton and materials remain from the pack.
- Quaternius, [Universal Animation Library Standard](https://quaternius.itch.io/universal-animation-library): `UAL1_Standard.glb`. Preview applies rest-pose compensation to the matching named humanoid skeleton and preserves the target limb offsets and scales.

These are technical comparison characters, not Tavi's final character design.
Original archives and unrelated models are not required by the runtime.

`kaykit/Tavi_Ranger.blend.glb` is a Blender re-export of the CC0 Ranger with
the matching Idle_A, Walking_A and Running_A clips, plus an original
`Tavi_LookAround` acting study authored from the idle pose. Reproduce it with
`tools/avatar-lab/blender_setup.py` inside Blender. The editable scene and import
inventory are written to `build/avatar-blender/`; that folder is generated output.

`quaternius/root-motion.json` records root travel distances and durations for
the selected clips, extracted from the same pack's `UAL1_Standard_RM.glb` for
calibration tests. The original CC0 animation license covers this source too.
