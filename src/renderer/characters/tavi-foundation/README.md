# Foundation pressure palm

The foundation-only asset adds a flattened pressure pad and thumb to the existing left-hand
Solo. It uses the approved skin color and hand style. Original artwork by alisketch, CC BY
4.0; attribution remains in `public/credits/rive-avatar.md`. The refined asset is unchanged.

The rest clip hides the pressure variant and restores the original hand. The foundation
binder fades it with prop support. Contact IK raises the wrist by the transformed cap radius;
the palm's flat edge is aligned to the support plane. Ordinary expressions keep their existing
tracks. The JSON profile records dimensions and the untouched base asset hash.

Reproduce after `python tools/tavi-rive-lab/build.py`:

```powershell
python tools/tavi-rive-lab/pressure_palms.py --export
```

The generator verifies and inspects the runtime project before export. The runtime inspection
reports no default state machine intentionally: the app owns animation playback. The small
`art/tavi-rive-lab/pressure-palm-review` project previews the component natively with the Rive CLI.
Generated authoring projects stay ignored; the generator and runtime asset are committed.

`node tools/pressure-palm-check.mjs` uses the Vite lab on 5175 to compare visible pressure art
on/off in the actual Rive renderer. `tools/rig-foundation-check.mjs` measures palm alignment
and writes the contact atlas. Production/browser and native delivery checks remain separate.
