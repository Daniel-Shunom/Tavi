# Character variants: research and design guide

Status: research for Tavi's character variants (skin tones, hair, bodies, faces, features), done
before implementation on October 26, 2026. Parts 1–6 summarise sources. Part 7 is the design
guide that the variant system (`docs/character/VARIANTS.md`) and its tests implement.

How claims are marked:

- **[F]**: the page was fetched and read. A quote marked [F] comes from that page.
- **[S]**: the claim comes from a search snippet or from secondary coverage only.
- **[U]**: I looked for this and could not verify it. Never cite an [U] claim as fact.
- _Inference_: my own synthesis for a 220 px flat-vector chibi, not a sourced fact.

Several premises in the brief turned out wrong when checked. They are corrected inline, and part 8
lists them all.

## 1. Inclusive design principles

### Microsoft Inclusive Design

The toolkit has three principles [F] ([Microsoft Inclusive Design][ms-id]):

- **Recognise exclusion.** "We acknowledge bias and recognize exclusions that happen because of
  mismatches between people and experience."
- **Learn from diversity.** People's "fresh, diverse perspectives are the key to true insight."
- **Solve for one, extend to many.** "Creating products for people with permanent disabilities
  creates results that benefit everyone."

Microsoft Design "defines disability as mismatched human interactions." Its persona spectrum
treats permanent, temporary and situational cases as one continuum. An example is one arm, an arm
injury, and a new parent holding a baby: about 26,000 people in the US have one arm, but about 21
million fall on that spectrum [F] ([Microsoft News 2019][ms-news]).

_Inference:_ for an avatar, the "mismatch" is not being able to make a companion that looks like
you or your community. An optional hearing aid helps the streamer who wears one. It also tells
their audience that the product expected them.

### Xbox avatars (2017–2018)

- The new avatars were "built from the ground up to enable an unprecedented amount of inclusive
  customization options." They offered "a wide range of body types and gender-neutral clothing,"
  and every feature, skin tone included, supports "over 16 million color options" [F]
  ([Xbox Wire 2018-06-18][xbox-editor]).
- The team said: "Almost all of our changes were based on feedback collected over the last ten
  years." Players had asked for "more inclusive body choices, different body shapes." The team
  "didn't expect that hair and facial hair would be deemed the most important assets by Xbox
  Insiders" and reprioritised toward them [F] ([Xbox Wire Q&A 2018-09-18][xbox-randy]).
  **Hair is where players feel represented or excluded first.**
- Prosthetic limbs, wheelchairs and a pregnancy option were shown at E3 2017 [S]
  ([TechRaptor][techraptor-xbox]; [Six Colors][sixcolors]). The wheelchair was first announced in
  July 2016 [F] ([Kill Screen][killscreen]). The brief said 2019; the sources support 2016–2018.

### Apple Memoji and Google emoji

- iOS 15 (announced May 2021) added Memoji with "oxygen tubes, cochlear implants, and a soft helmet
  for headwear" [F] ([Apple Newsroom 2021-05-19][apple-2021]). It also added a different colour
  for each eye [F] ([MacRumors][macrumors-ios15]).
- EURO-CIU, a cochlear-implant users' federation, had lobbied for the cochlear implant since 2018
  and welcomed it [S] ([CIICA][ciica]). This is an affected community asking for a feature and
  endorsing it.
- Memoji launched in 2018 with headscarves and turbans. iOS 14 added a durag, waves and fades. iOS
  16 added box braids, more curly styles, 12 nose shapes and a bonnet [F]
  ([9to5Mac 2022][9to5-ios16]; [S] [Hypebae][hypebae]).
- Apple's March 2018 accessibility emoji proposal was developed with the American Council of the
  Blind, the Cerebral Palsy Foundation and the National Association of the Deaf. It proposed both
  manual and motorised wheelchairs because "it would not be realistic to insinuate that they have
  less mobility than they do" [F] ([Emojipedia][emojipedia-a11y]).
- In 2016 Google dropped its gender-neutral yellow "blob" people. One reason given was skin tones:
  "the blobs look great in yellow, but would look a bit weird if they had skin tones applied" [F]
  ([Emojipedia 2016][emojipedia-blob]). _Lesson:_ a fantasy-coloured character and a human skin
  ramp pull in different directions, so choose deliberately. Tavi keeps the original mascot's
  fantasy pink as one option, labelled as the original, alongside a real human ramp.

### Unicode skin-tone modifiers (UTS #51)

From UTS #51 v18.0 [F] ([Unicode][uts51]):

- "Five symbol modifier characters … are based on the six tones of the Fitzpatrick scale … The
  exact shades may vary between implementations." The lightest modifier merges types 1 and 2.
- With no modifier, emoji "should use a generic, non-realistic skin tone, such as RGB #FFCC22".
- On hair: "dark hair is generally regarded as more neutral."
- The standard admits its limits: "There are many other types of diversity in human appearance
  besides different skin tones."
- UTS #51 does not mention race at all. The popular claim that Unicode explicitly says "skin tone,
  not race" is [U].
- The Fitzpatrick scale was built for UV tolerance and under-represents darker skin. Google's
  10-shade Monk Skin Tone Scale (2022, with Dr. Ellis Monk) was designed to fix this. In a survey
  of about 3,000 people it matched people about as well as a 40-shade palette [S]
  ([Harvard Gazette][monk]). **Ten well-spaced tones with deliberate coverage of dark skin is a
  supported target.**

### Character creators that changed after feedback

- **The Sims 4.**
  - In 2020 Maxis fixed "blotchy artifacts" and an "ashy appearance" on darker skin, and promised
    "a hundred new skin tone swatches … with a particular emphasis on darker skin tones" plus a
    slider on every swatch [F] ([Sims blog mirror 2020-09-23][sims-skin]). These shipped in
    December 2020 (144 tones in warm, neutral, cool and misc groups) [S] ([SimsCommunity][sims-dec]).
  - In 2024 EA wrote: "Games have often dramatically underrepresented Black hairstyles." It
    credited prior work with community creator Danielle "Ebonix" Udogaranya and partnered with
    Dark & Lovely on colours and a locs style [F] ([EA 2024][sims-dl]).
  - Vitiligo shipped on 13 Feb 2024 [F] ([EA dev diary][sims-vitiligo]). The brief said 2021.
- **Animal Crossing: New Horizons.** The player chooses a "style", not a gender, and "all the
  facial parts or hairstyles are all gender-free." It was the first mainline game with skin tone
  [S] ([Animal Crossing World][acnh]). Its 2.0 update added no locs, afros or Bantu knots [F]
  ([Nookipedia][nookipedia]).
- **Roblox (2024).** Skin tone became any colour because fixed palettes "didn't include shades that
  allowed everyone to feel appropriately represented" [F] ([Roblox DevForum][roblox]).
- **Bitmoji Deluxe (2018).** 40 skin tones, 50 hair colours, and "braids and levels of curl" [S]
  ([TechCrunch][bitmoji]).
- **Dragon Age: The Veilguard (2024).** 40 complexions with undertones, a vitiligo slider, physics
  hair, and no gendered body labels [S] ([Inverse][veilguard]). Critics said the dark range still
  felt limited [S].
- **Barbie Fashionistas.** "176 dolls with nine body types, 35 skin tones and 94 hairstyles" [S]
  ([NBC Connecticut][barbie]). Mattel made the vitiligo doll with a dermatologist and the hearing
  aid doll with an audiologist [S] ([MDedge][barbie-vit]; [Fox 29][barbie-ha]).
  **A small set of fully designed body types works.**

## 2. Representation ethics

### Caricature

Minstrel and animation caricature codes exaggerated mouths, "large red lips, a flat nose" and
"bulging eyes" [S] ([Jim Crow Museum][jimcrow]). Disney+ shows a non-skippable advisory on older
films: "These stereotypes were wrong then and are wrong now" [S] ([WDWNT][disney-advisory]).

**Rule:** Tavi's eyes, nose, mouth and lip colour never change with skin tone. Face shape,
hairstyle and skin tone are independent controls, and every option is available with every tone.

### "Race presets" and coupling

Researcher Aleena Chia calls MetaHuman Creator's "diverse series of presets" "diversity surfing",
which treats race as cosmetic [S] ([Chia][chia]). Players also dislike creators where the only
variation is a palette swap [S]. The answer is independent axes, all available to all, and never
bundles labelled by race. Named presets are allowed only as starting points that list neutral
features ("Tone 8, locs, soft-square face").

### "Default equals white"

The yellow default emoji is meant to be "non-realistic" [F], but a study found people assumed
yellow-default senders were White [S] ([ISCTE][iscte]). Defaults are never neutral by accident:

- Choose the default deliberately.
- Never list the lightest human tone first by default.
- Never let "no choice made" mean light skin.

### Ashy, grey and under-lit dark skin

- Photography's colour references were calibrated on "Shirley cards" of white women. Lorna Roth
  traces how that shaped film and video [S] ([Roth 2009][roth]).
- Google's Real Tone camera work targets stray light "which can make darker skin look ashy or
  washed out" [S] ([Boston Globe][realtone]).
- Writing about games, Yussef Cole and Tanya DePass argue that "Black skin needn't be drab, muddy
  and devoid of detail." They note dark-skinned characters can "look the same exact color as the
  background" [F] ([Vice 2017][vice]).
- Ava Berkofsky, director of photography on _Insecure_: "no one ever talked about lighting
  nonwhite people." Rather than "pound someone's face with light," she has light reflect off them
  [F] ([Mic][mic]).
- The Sims team itself used the word "ashy" for its own defect [F].

I found no single authoritative source for the rule "warm, saturated shadows, never grey."
Painting tutorials describe warm and cool layered shading and reflected highlights [S]
([Clip Studio][clip-skin]). The Tavi rule is a synthesis of the sources above: every skin shade
is a hue shift with kept or raised saturation, never a mix toward grey or black. The highlight is
warm and luminous, so dark tones keep form and edge.

### Naming

Crayola renamed "Flesh" to "Peach" in 1962 [S] ([Museum of Play][crayola]). **Never name a swatch
by race, "nude", "flesh" or a food** (food names for skin are widely criticised as objectifying;
_inference_). Tavi uses "Tone 1–10" plus undertone words (warm, neutral, cool, olive).

### Consulting affected communities

How larger studios do it:

- **Ghost of Tsushima / Yōtei.** Advisers, including an Ainu cultural adviser, and a stance of
  "being a learner" [F] ([PlayStation Blog][ghost]).
- **Spider-Man: Miles Morales.** Interviews with East Harlem residents and in-home playtests [S]
  ([Marvel.com][miles]).
- **Tell Me Why.** Consulted GLAAD on character design [S] ([NBC News][tmw]).
- **Moana.** The Oceanic Story Trust reportedly changed Maui's design [S] ([NBC News][moana]).
- **Barbie.** Worked with a dermatologist and an audiologist (above).

What small teams can do [S] ([IGDN][igdn]):

- Bring sensitivity readers in "as early as possible."
- Prefer a co-designer with lived experience to a reviewer at the end.
- Pay people, and never in "exposure."
- Treat review as ongoing.

**What Tavi does now, with no consultant budget:**

1. Follow published community-made guidance (Dove and the Open Source Afro Hair Library's _Code My
   Crown_, the Envato tutorials below, the NHS on vitiligo).
2. Keep every choice data-driven and reversible: swatches, shapes and labels live in one file.
3. Say plainly in the docs and the creator that no community review has happened yet.
4. Give streamers a feedback path.
5. Never claim endorsement or speak for a group.
6. Before release, pay for review by Black and textured-hair artists of the hairstyles and the
   dark end of the ramp, and by disabled people of the accessibility features. This needs the
   user's budget decision.

## 3. Hair representation

### Vocabulary

- The Andre Walker system (1 straight to 4 coily, with letter subtypes) was created partly to sell
  a product line. It ranks straight hair "1", ignores density and mixed textures, and is vague at
  4C. Critics link hair typing to colonial-era hair gauges [S] ([Afrocenchix][afrocenchix];
  [HJI][hji]).
- Tavi names styles ("coily afro", "locs", "puffs") and never uses type numbers.
- Many people prefer **"locs"** to "dreadlocks"; the origin of "dread" is disputed [S]
  ([Wikipedia][locs-wiki]). Tavi says "locs".

### Drawing textured hair accurately

From Envato Tuts+ [F] ([afro hair][tuts-afro]; [afros, locs, braids, twists][tuts-styles]):

- Coily hair grows **up and out** with "a methodology to it", and is "typically quite voluminous."
- Coils shrink: hair looks much shorter than it is.
- Pulling hair back moves the volume rather than removing it, so a puff keeps its volume.
- Named errors:
  - drawing the afro as a perfect circle or sphere
  - haphazard fill lines
  - straight lines in coily hair
  - ignoring the skull under the volume
- Texture belongs at the hairline and edges.
- **Locs** are cylinders layered from the hairline and wrapping the skull ("thick spaghetti
  around … a bowling ball"). They need curved lines for depth.
- **Braids** are cylinders of alternating strokes. **Two-strand twists** use a start stroke and a
  close stroke per segment.

Kotaku Australia praised Cyberpunk 2077 because it "correctly realises the hair for the braid has
to come from somewhere," showing hair from the scalp feeding into each cornrow [S]
([Kotaku AU][kotaku-cp]). **Braids and cornrows need visible scalp parts and roots.**

Dove and the Open Source Afro Hair Library's **Code My Crown** (2023) is a free guide of about 200
pages for 3D artists, made with Black artists and academics. Dove reports that 85% of Black gamers
feel underrepresented in hair, and only 7% of hairstyles in four popular games are textured or
protective [S] ([Cosmetics Business][codemycrown]; [Dove][dove-cmc]). It is the reference to get
for any future hairstyle work.

Why it matters: Dove's 2019 CROWN study found Black women's hair 3.4× more likely to be perceived
as unprofessional. About 27–30 US states now have CROWN-style laws [S] ([CROWN Act][crown];
[Wikipedia][crown-wiki]).

Pixar's _Soul_ studied barbershops to render Black hair's texture [S] ([AWN][soul]). _Hair Love_
(Oscar 2020) shows a father learning to style his daughter's hair [S] ([NBC News][hairlove]).

### Head coverings

- The hijab emoji (🧕, Unicode 10.0) was proposed by Rayouf Alhumedhi at 15. Its scarf was made a
  neutral colour "to be more widely applicable across cultures," and the designer avoided white,
  grey and blue so it would show on chat backgrounds [F] ([Cooper Hewitt][hijab]). Alhumedhi: it
  "just really normalizes it."
- The Sims 4 added a hijab and athletic hijab as separate items that mix with any outfit [F]
  ([SimsCommunity 2019][sims-hijab]).
- The Sikh dastar is an article of faith that covers uncut hair [S] ([Wikipedia][dastar]). The
  gele is a sculptural Yoruba head tie [S] ([Wikipedia][gele]).
- **Rules:**
  - Head coverings are their own control, not hats or costumes.
  - They work with every tone, body and face.
  - They are never tied to skin tone or gender.
  - They never animate as a gag.

### Hair colour

- Natural colour is the ratio of eumelanin (black and brown) to pheomelanin (red and yellow).
  Grey has less pigment and white has none [S] ([MedlinePlus][medline]).
- Pure black hair is rare. Dark hair reads when it carries a brown or blue undertone and a visible
  highlight [S] ([CMON forum][cmon]).
- Tavi groups natural colours separately from dyes and never couples hair colour to skin.

### Per-style drawing spec (Tavi scale, flat fill, one shade, one highlight)

_Inference_ that applies the sources above:

| Style         | Silhouette and volume                                                                           | Texture cue at 220 px                                                                        | Motion                              |
| ------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------- |
| Coily afro    | Big, irregular cloud edge (10–16 arcs), fuller at the crown, not a circle, resting on the skull | Scalloped outline, small coil marks in the shade colour near the edges, clustered highlights | Stiff: tiny bounce, no strand swing |
| Puffs         | Smooth, slightly shaded scalp toward a band, then a cloud-edged ball                            | Band, afro edge on the puff                                                                  | Each puff a soft spring bob         |
| Bantu knots   | Several small spiral domes in a grid                                                            | Spiral line per knot, scalp parts between                                                    | Rigid                               |
| Locs          | Cylinders of varying width from the hairline, wrapping the skull, rounded ends                  | Width variation, segment bands, never even noodles                                           | Heavy grouped bundles, slow swing   |
| Box braids    | Long curtain of distinct braids                                                                 | Chevrons down each braid, grid parts at the crown, banded tips                               | Heavy, slow, 3–5 bundles            |
| Cornrows      | Head shape stays visible                                                                        | Rows from the hairline with scalp parts and "V" stitches                                     | Rigid                               |
| Bob           | Clear jaw-level hem, optional fringe                                                            | One sheen band                                                                               | Medium swing per side               |
| Pixie         | Close to the skull, 2–4 soft tufts                                                              | Tuft tips                                                                                    | Nearly rigid                        |
| Long straight | Tall curtain broken into tapered locks                                                          | Vertical sheen band                                                                          | Low damping, swings                 |
| Buns          | Round mass with a wrap line                                                                     | Wrap line                                                                                    | Tiny bob                            |
| Buzz / waves  | Close cap following the skull                                                                   | Concentric shade arcs (waves)                                                                | Rigid                               |

## 4. Body, age, gender expression, disability

### Bodies without the joke

- A review of 15 years of research found that media "portray overweight and obese individuals in a
  stigmatizing manner" [S] ([Ata & Thompson 2010][ata]).
- A Rudd Center study of 370 news videos found obese people portrayed negatively 65% of the time,
  often framed as "headless, hungry, and unhealthy" [S] ([APHA][puhl]).
- Critics of "Fat Monica" place the harm in mockery and the before/after arc, not in the body
  itself [S] ([Paste][paste]).
- Disney's _Reflect_ (2022) shows that even well-meant plus-size stories tend to make the body the
  plot [S] ([NPR/KUNC][reflect]).

**Rule:** every body type does every expression, gesture, gait and choreography identically. No
reaction ever references a body, and nothing jiggles for comedy.

### Chibi bodies

- Chibi bodies run from 2 to 3 heads tall.
- The torso is "bean-shaped… like a pear," with weight low. An average chibi has "no real
  shoulders."
- Chibis are "often simplified enough that no gender distinction is visible" [F]
  ([Clip Studio][clip-chibi]).
- A fat artist's advice: fat sits in zones (cheeks, belly, hips, thighs), so do not scale one
  template uniformly [S] ([mirror][fat-art]).
- **Tavi:**
  - Keep head size, eye construction and head-to-body ratio fixed.
  - Vary torso width, the skirt or hip line, shoulder spacing, limb thickness and face fullness
    together.

### Age

- Older characters were historically "used mainly for laughs" [S] ([AWN][awn-age]).
- Signal age with a few placed lines, not wrinkles drawn for comedy [S] ([Clip Studio][clip-age]).
- **Tavi:** an elder option adds one smile-line stroke per side. Grey or white hair is a separate
  hair colour choice. No hunch and no cane by default.

### Gender expression

- In 2016, The Sims 4 unlocked all clothing, hair and voices for every Sim, working with GLAAD [S]
  ([Game Informer][sims-gender]).
- Animal Crossing: New Horizons asks for no gender [S].
- Duolingo on its LGBTQ characters: "It's just a single part of their identity… it doesn't define
  them" [F] ([Duolingo][duo-lgbtq]).
- **Tavi:** never ask for gender. Hair, facial hair, body and face are one shared pool.

### Disability

- "Nothing About Us Without Us" [S] ([Charlton 1998][charlton]).
- Stella Young on "inspiration porn": disability is not exceptional and is not there "for the
  benefit of nondisabled people" [S] ([DVP][young]).
- RespectAbility: no character is a hero or villain "based solely on the fact that they have a
  disability" [S] ([RespectAbility][respectability]).
- Wheelchair users say artists wrongly draw hospital chairs. Daily users have light, rigid chairs
  with no push handles [S] ([The Mary Sue][marysue]).
- Vitiligo:
  - It "commonly happens on the face, neck and hands, and in skin creases," around the mouth and
    eyes. Non-segmental vitiligo (about 9 in 10 cases) is "symmetrical white patches" [F]
    ([NHS][nhs-vitiligo]).
  - The Sims made patches adjust with skin tone and apply "only to skin." Affected skin "can be
    absolutely white, or can be pink or varying shades lighter" [F] ([EA][sims-vitiligo]).
  - Winnie Harlow is not a "vitiligo sufferer" [S] ([W Magazine][harlow]).
- Avoid the "evil albino" trope [S] ([Penn State][albino]).
- **Tavi:**
  - Every condition or device is an independent trait on any body, age or tone.
  - No reaction references a trait.
  - Devices are drawn as everyday objects in user-picked colours.

## 5. Chibi style consistency, readability and contrast

- **Duolingo illustration guidelines** (now redirected; quoted from snippets) [S]
  ([design.duolingo.com][duo-guide]):
  - "All of our illustrations are made from three basic shapes: the rounded rectangle, the
    circle, and the rounded triangle."
  - "Pointy shapes are off-brand."
  - Eyes are geometric.
  - Ground shadows are a pill shape.
- **Shape language**: circles read soft and approachable, squares stable, triangles energetic [S].
  Keep triangles rounded.
- **Silhouette test**: fill the figure solid. Each variant should differ in silhouette (hair mass,
  torso width), not only in colour [S] ([21 Draw][21draw]).
- **Values first**: shapes should separate in greyscale. Shift hue in shadows instead of only
  darkening [S] ([CG Cookie][cgcookie]). Keep skin as the middle value, hair a clear step lighter
  or darker, and the outfit a third value.
- **WCAG 2.1 SC 1.4.11**: parts of graphics "required to understand the content" need at least 3:1
  contrast against adjacent colours, tested at "the least contrasting area" [F] ([W3C][wcag]). A
  companion over arbitrary game footage cannot guarantee 3:1 from fills alone. Tavi applies the
  3:1 idea between hair and skin, and between features and skin. Silhouette-to-background contrast
  belongs to a renderer-level halo or shadow shared by all variants, not to dark tones alone.

## 6. Duolingo's cast as a case study

- Greg Hartman: "We knew this cast would have to be diverse, fun, and complement our existing
  green owl mascot." The cast especially showcases people "typically underrepresented in Western
  media." All characters "had to resemble Duo," built from the "same basic shapes." The work took
  about 18 months, with scrapped designs [F] ([Building character][duo-building]).
- Megan Barker: "the fewest details needed to get the point across," and "exaggerate key details
  almost to the point of caricature" (of personality, not identity). White space keeps things
  readable small [F] ([Shape language][duo-shape]).
- Emily Chiu: "It was really important for us to have different ages, ethnicities, and
  personalities," with personalities designed as contrasting pairs [F]
  ([Origin stories][duo-origin]).
- Taylor Burgess: new characters must be "interesting, but not too wild as to distract from the
  main cast" [F] ([Internship][duo-intern]).
- I found no evidence that a core Duolingo character has a depicted disability [U, negative].

**What Tavi takes from this:**

- One shape kit shared by the whole cast (the mascot's rounded forms).
- One eye construction.
- A fixed head ratio.
- Diversity across several axes at once.
- Identity shown but never made the subject.

## 7. Tavi variant design guide

### Do

1. **Same rig, every variant.** Variation is data: colours, scales, vertex offsets and overlay
   shapes. Never fork the motion contract.
2. **Independent axes.** Skin tone, undertone, face shape, body, hair style, hair colour, eye
   colour, features and head covering each change one thing. All options are available to all.
3. **Warm, saturated shading.** Every skin shade rotates hue toward red or orange and keeps or
   raises saturation. Highlights are warm. Nothing is mixed toward grey or black.
4. **Real volume for textured hair.** Afros, puffs and locs grow up and out from the skull, with
   texture at the edges and scalp parts for braids and cornrows.
5. **Neutral descriptions.** Presets describe features ("Tone 8 · locs · soft-square face"), never
   people or races.
6. **Same performance.** Every variant performs every expression, gait, body state and
   choreography identically.
7. **Check at 220 px.** Over light, dark, mid-grey and saturated backgrounds, on the contact sheet.

### Don't

1. Change eyes, nose, mouth or lip colour with skin tone, or tie any feature to a tone.
2. Ship race presets, or name swatches by race, "nude", "flesh" or food.
3. Default to the lightest tone or list it first by default.
4. Draw textured hair as a recoloured straight silhouette, a smooth helmet or a perfect circle.
5. Make a body, age, device or condition the subject of a reaction or a joke.
6. Gate head coverings, hair, facial hair or bodies by gender.
7. Make a dark tone that reads as grey, or that loses the face against the hair.

### Skin-tone ramp (implemented in `src/renderer/characters/variants/skin.ts`)

- Ten tones are spaced in lightness, with five of the ten in the medium-to-deep range.
- Each tone has three colours:
  - **base**: face, limbs and eyelids
  - **shade**: ears, neck and the nose line
  - **highlight**: the face gradient's light end
- Undertones (warm, neutral, cool, olive) shift hue and saturation and never desaturate below the
  floor.
- Rules enforced by `tests/variants.test.ts` (measured in OKLCH, a perceptual colour space):
  - Lightness decreases from Tone 1 to Tone 10 in steps of more than 0.035 L, for every undertone.
  - The shade is darker than the base by more than 0.05 L. Its hue is the same or rotated toward
    red by less than 16°, and its chroma is at least 95% of the base's. **Never ashy:** chroma
    never drops toward grey.
  - The highlight is lighter and warm: its hue stays between 30° and 90° (orange to yellow).
  - Every base keeps chroma above 0.03, so no tone reads grey. The lightest tones legitimately
    carry little colour.
  - The nose line and mouth line are at least 0.12 and 0.15 L darker than the skin for every tone.
    The mouth keeps one berry hue (within 15°) for everyone. WCAG contrast ratios compress at the
    dark end (any dark line on deep skin scores below 3:1), so legibility is measured as a
    perceptual lightness difference and checked on the contact sheet at 220 px.
  - Colours are hand-tuned (`shared/variants.ts`), not generated by mixing with black.

| Tone | Base      | Shade     | Highlight |
| ---- | --------- | --------- | --------- |
| 1    | `#f7dccb` | `#e7b39c` | `#fff0e6` |
| 2    | `#f0c8aa` | `#dc9f7f` | `#fbe0c9` |
| 3    | `#e4b089` | `#ca8760` | `#f4cdad` |
| 4    | `#d39a6f` | `#b6714a` | `#e9b991` |
| 5    | `#bf835a` | `#9f5e38` | `#dba37b` |
| 6    | `#a66a42` | `#854a29` | `#c78b60` |
| 7    | `#8c5434` | `#6e381e` | `#b17550` |
| 8    | `#734229` | `#582a16` | `#9c6546` |
| 9    | `#5c3220` | `#441d0f` | `#8b573c` |
| 10   | `#472518` | `#341207` | `#7a4832` |

The original mascot's fantasy pink is kept as a separate "Original" option, not as part of the
human ramp.

### Hairstyles, by priority

1. Locs (shoulder-length, grouped)
2. Coily afro
3. Box braids (long)
4. Puffs (two)
5. Bob (jaw-length, fringe)
6. Pixie
7. Long straight
8. Top bun
9. Bantu knots
10. Cornrows
11. Buzz with waves
12. High ponytail
13. Original curls (the mascot's own hair)
14. Shaved / bald

Head coverings (separate control): hijab, dastar (turban), headwrap.

### Body parameters

There are four builds, all at the same chibi height (2.6 heads), the same head and the same feet:

| Build   | Torso width | Hip / skirt | Shoulder spacing | Limb thickness | Face fullness |
| ------- | ----------- | ----------- | ---------------- | -------------- | ------------- |
| Slim    | 0.88        | 0.9         | −3               | 0.85           | —             |
| Average | 1           | 1           | 0                | 1              | —             |
| Broad   | 1.16        | 1.08        | +5               | 1.12           | —             |
| Full    | 1.3         | 1.3         | +7               | 1.3            | +4% width     |

Height (short or tall) needs leg-length changes that move the hips relative to the planted soles.
That breaks `soleOffset` semantics in this rig, so it is specified for the remixed rig instead
(`VARIANTS.md`, authoring specs).

### Defaults and naming policy

- **The existing config default stays the original mascot look**, so saved companions do not
  change. Changing the default is a product decision for the user (see `VARIANTS.md`).
- New presets are listed in an order that does not start with the lightest tone.
- Labels: "Tone 1–10", undertone words, style names ("Locs", "Coily afro"), builds ("Slim",
  "Average", "Broad", "Full"), and feature names ("Freckles", "Vitiligo", "Hearing aid").
- Preset names are plain friendly names with no ethnic connotation.

### Checklist for every new variant or hairstyle

- [ ] It passes the rig-contract test: same nodes, controls, tracks and `soleOffset`.
- [ ] It performs at least three expressions and a walk on the contact sheet with no clipping,
      popping or detached parts.
- [ ] It reads at 220 px over light, dark and busy backgrounds, and its silhouette differs from
      the others.
- [ ] Its skin uses the ramp: no grey, and the face stays readable against hair and background.
- [ ] Features, eyes and mouth are unchanged by tone. No exaggerated lips or nose, and no race
      label.
- [ ] Textured hair has real volume, growth direction, edge texture and scalp parts where
      applicable.
- [ ] No trait is the subject of a reaction or a joke.
- [ ] Head coverings work with every tone, face and body.
- [ ] Its credit includes the CC BY 4.0 base art (`public/credits/`).
- [ ] Community review status is recorded honestly in `VARIANTS.md`.

## 8. Corrections to the brief and unverified items

Corrections:

- Sims skin tones shipped in 2020, and Sims vitiligo in 2024.
- Xbox showed prosthetics and wheelchairs in 2016–2018.
- Memoji cochlear implants arrived in iOS 15 (2021).
- Apple's accessibility emoji proposal was March 2018.
- Animal Crossing 2.0 has no locs or afros.

Unverified [U]:

- A Unicode "skin tone, not race" statement.
- A primary Xbox post on prosthetics.
- Veilguard's coily-hair tooling or consultants.
- Whether the Sims locs shipped (only the announcement is confirmed).
- Bantu knot and durag origins.
- Any Duolingo character with a disability.

## Sources

[ms-id]: https://inclusive.microsoft.design/
[ms-news]: https://news.microsoft.com/en-xm/2019/04/26/making-the-digital-world-more-inclusive/
[xbox-editor]: https://news.xbox.com/en-us/2018/06/18/new-avatar-editor-debuts-to-xbox-insiders/
[xbox-randy]: https://news.xbox.com/en-us/2018/09/18/randy-from-xbox-avatars/
[techraptor-xbox]: https://techraptor.net/content/e3-2017-microsoft-introduces-new-avatars
[sixcolors]: https://sixcolors.com/link/2017/06/xbox-live-avatar-revamp-focuses-on-diversity-customization/
[killscreen]: https://killscreen.com/xbox-avatars-will-now-include-option-wheelchairs
[apple-2021]: https://www.apple.com/newsroom/2021/05/apple-previews-powerful-software-updates-designed-for-people-with-disabilities/
[macrumors-ios15]: https://macrumors.com/2021/06/07/apple-new-memoji-ios-15
[ciica]: https://ciicanet.org/2021/05/21/euro-ciu-welcomes-new-apple-memoji-depicting-a-cochlear-implant-user/
[9to5-ios16]: https://9to5mac.com/2022/09/14/memoji-ios-16-everything-new/
[hypebae]: https://hypebae.com/2020/6/apple-face-mask-memoji-stickers-ios-14-wwdc-release
[emojipedia-a11y]: https://blog.emojipedia.org/apple-proposes-new-accessibility-emojis/
[emojipedia-blob]: https://blog.emojipedia.org/android-n-drops-gender-neutral-emojis/
[uts51]: https://www.unicode.org/reports/tr51/
[monk]: https://news.harvard.edu/gazette/story/2022/07/teaching-algorithms-about-colors-of-people/
[sims-skin]: https://simscommunity.info/2020/09/23/the-sims-blog-how-were-addressing-skin-tone-improvements-in-the-sims-4/
[sims-dec]: https://simscommunity.info/2020/12/08/the-sims-4-december-2020-update-overview/
[sims-dl]: https://www.ea.com/games/the-sims/the-sims-4/news/the-sims-dark-and-lovely
[sims-vitiligo]: https://www.ea.com/en/games/the-sims/the-sims-4/news/dev-diary-vitiligo
[sims-hijab]: https://simscommunity.info/2019/09/05/the-sims-4-new-update-patch-notes-september-5th-2019/
[sims-gender]: https://gameinformer.com/b/news/archive/2016/06/04/the-sims-4-loosens-gender-restrictions-for-customization-options.aspx
[acnh]: https://animalcrossingworld.com/2019/06/gender-neutral-hair-and-face-styles-can-be-changed-at-any-point-in-animal-crossing-new-horizons/
[nookipedia]: https://nookipedia.com/wiki/Hair_Styles
[roblox]: https://devforum.roblox.com/t/expanding-the-skin-tone-color-picker/2964644
[bitmoji]: https://techcrunch.com/2018/01/30/bitmoji-deluxe
[veilguard]: https://www.inverse.com/gaming/dragon-age-veilguard-trans-characters
[barbie]: https://www.nbcconnecticut.com/entertainment/the-scene/new-barbie-line-dolls-with-vitiligo-no-hair-prosthetic-limbs/2216629/
[barbie-vit]: https://mdedge.com/content/new-barbie-lineup-includes-doll-vitiligo
[barbie-ha]: https://www.fox29.com/news/1st-ever-barbie-with-behind-the-ear-hearing-aids-unveiled-as-part-of-mattels-most-diverse-doll-line
[jimcrow]: https://jimcrowmuseum.ferris.edu/antiblack/
[disney-advisory]: https://wdwnt.com/2020/10/disney-updates-content-advisory-saying-these-stereotypes-were-wrong-then-and-are-wrong-now/
[chia]: https://www.taylorfrancis.com/chapters/oa-edit/10.4324/9781003463139-15/photogrammetric-race-making-metahuman-creator-aleena-chia
[iscte]: https://repositorio.iscte-iul.pt/handle/10071/32622
[roth]: https://doi.org/10.22230/cjc.2009v34n1a2196
[realtone]: https://www.bostonglobe.com/2021/11/25/business/digital-camera-that-gets-dark-skin-right-what-took-so-long
[vice]: https://vice.com/en/article/black-skin-is-still-a-radical-concept-in-video-games
[mic]: https://mic.com/articles/184244/keeping-insecure-lit-hbo-cinematographer-ava-berkofsky-on-properly-lighting-black-faces
[clip-skin]: https://tips.clip-studio.com/en-us/articles/16821
[crayola]: https://www.museumofplay.org/blog/the-importance-of-coloring-and-authentic-self-expression/
[ghost]: https://blog.playstation.com/?p=406221
[miles]: https://www.marvel.com/articles/games/brian-horton-describes-work-on-marvels-spider-man-miles-morales
[tmw]: https://www.nbcnews.com/feature/nbc-out/tell-me-why-video-game-features-transgender-lead-character-n1239123
[moana]: https://www.nbcnews.com/news/asian-america/dance-storytelling-art-wayfinding-behind-scenes-disney-s-moana-n672141
[igdn]: https://igdnonline.com/blog/2023/1/31/world-building-for-game-designers-bpgzj-6fya8
[afrocenchix]: https://afrocenchix.com/blogs/afrohair/why-hair-typing-is-unscientific
[hji]: https://hji.co.uk/is-the-hair-typing-system-due-an-update
[locs-wiki]: https://en.wikipedia.org/wiki/Dreadlocks
[tuts-afro]: https://design.tutsplus.com/tutorials/how-to-draw-natural-afro-textured-hair--cms-31661
[tuts-styles]: https://design.tutsplus.com/es/tutorials/how-to-draw-natural-textured-afro-hairstyles-afros-locs-braids-twists--cms-31686
[kotaku-cp]: https://www.kotaku.com.au/?p=1198295
[codemycrown]: https://www.cosmeticsbusiness.com/dove-unveils-industry-first-guide-for-creating-afro
[dove-cmc]: https://www.dove.com/us/en/campaigns/purpose/code-my-crown.html
[crown]: https://www.thecrownact.com/resources-1
[crown-wiki]: https://en.wikipedia.org/wiki/Discrimination_based_on_hair_texture_in_the_United_States
[soul]: https://www.awn.com/animationworld/pixars-soul-skillfully-and-honestly-embraces-ethnic-and-cultural-diversity
[hairlove]: https://www.nbcnews.com/news/nbcblk/oscar-nominated-hair-love-normalizes-celebrates-black-hair-creators-say-n1132826
[hijab]: https://www.cooperhewitt.org/2021/03/23/the-hijab-emoji-normalizing-identity/
[dastar]: https://en.wikipedia.org/wiki/Dastar
[gele]: https://en.wikipedia.org/wiki/Gele_(head_tie)
[medline]: https://medlineplus.gov/genetics/understanding/traits/haircolor
[cmon]: https://www.coolminiornot.com/forums/threads/painting-black-hair.3337/
[ata]: https://digitalcommons.usf.edu/psy_facpub/2235
[puhl]: https://apha.confex.com/apha/139am/webprogram/Paper237828.html
[paste]: https://pastemagazine.com/tv/insatiable/insatiable-netflix-brief-history-of-fat-suits-on-t
[reflect]: https://www.kunc.org/npr-news/2022-10-29/disney-revealed-its-first-plus-sized-heroine-not-everyone-is-happy-about-her
[clip-chibi]: https://tips.clip-studio.com/en-us/articles/4863
[fat-art]: https://www.gastdocent.uoc.cw/blog/choccochocco/757438625732526080
[awn-age]: https://www.awn.com/animationworld/dr-toon-showing-their-age
[clip-age]: https://tips.clip-studio.com/en-us/articles/7069
[duo-lgbtq]: https://blog.duolingo.com/lgbtq-representation-in-duolingo-stories-and-characters
[charlton]: https://www.ucpress.edu/book/9780520224810/nothing-about-us-without-us
[young]: https://disabilityvisibilityproject.com/2014/10/16/stella-young-inspiration-porn-and-the-objectification-of-disabled-people/
[respectability]: https://www.respectability.org/2021/01/respecting-the-ability
[marysue]: https://themarysue.com/?p=44688
[nhs-vitiligo]: https://www.nhs.uk/conditions/vitiligo/
[harlow]: https://www.wmagazine.com/story/winnie-harlow-vitiligo-sufferer-no
[albino]: https://www.psu.edu/news/research/story/probing-question-why-are-albinos-always-cast-villains
[duo-guide]: https://design.duolingo.com/illustration/characters
[21draw]: https://www.21-draw.com/?p=72073
[cgcookie]: https://cgcookie.com/lessons/exercise-41-color-shifting
[wcag]: https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html
[duo-building]: https://blog.duolingo.com/building-character/
[duo-shape]: https://blog.duolingo.com/shape-language-duolingos-art-style/
[duo-origin]: https://blog.duolingo.com/duolingo-female-character-origin-stories
[duo-intern]: https://blog.duolingo.com/designing-new-characters-internship
