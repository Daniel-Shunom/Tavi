// Tavi expression library: the single, model-independent source of truth for WHAT the companion can
// express. Character manifests bind these ids to artwork; the AI prompt and tool schema, Zod
// validation, behaviour rules and the studio gallery are all generated from this file.
// Nothing here may name an animation clip, artboard or renderer detail.
import { z } from 'zod';

export const channels = ['emote', 'gesture', 'attention', 'presence', 'idle'] as const;
export type Channel = (typeof channels)[number];
export const channelInfo: Record<Channel, { label: string; meaning: string }> = {
  emote: {
    label: 'Emote',
    meaning: 'Face and upper-body mood. One at a time; layers over gestures and attention.',
  },
  gesture: {
    label: 'Gesture',
    meaning: 'A deliberate body action such as a wave or nod. One at a time.',
  },
  attention: {
    label: 'Attention',
    meaning: 'Where Tavi is looking or orienting. Layers with everything.',
  },
  presence: {
    label: 'Presence',
    meaning: 'Where Tavi is on screen, such as peeking from the edge.',
  },
  idle: {
    label: 'Idle life',
    meaning: 'Small unprompted background behaviour. Never chosen by the AI; quiet mode stops it.',
  },
};

export const targets = ['streamer', 'chat', 'pointer', 'neutral'] as const;
export type Target = (typeof targets)[number];
export const targetSchema = z.enum(targets);

export interface ExpressionDefinition {
  channel: Channel;
  label: string;
  /** Plain-language meaning, written for both streamers and language models. */
  meaning: string;
  useWhen: string;
  avoidWhen: string;
  intensity: { min: number; max: number; default: number };
  /** Typical readable hold, in seconds, before recovery. */
  duration: number;
  /** Other channels this expression can play alongside. */
  layersWith: readonly Channel[];
  /** Interrupt priority within its channel (1 lowest, 5 highest). */
  priority: 1 | 2 | 3 | 4 | 5;
  /** Ordered model-independent substitutes when a character cannot perform this expression. */
  similar: readonly ExpressionId[];
  /** Whether the AI and behaviour rules may choose it. Idle and control-only states are excluded. */
  selectable: boolean;
}

const face = ['gesture', 'attention', 'presence'] as const;
const body = ['emote', 'attention'] as const;
const everything = ['emote', 'gesture', 'presence'] as const;

// Declared with `satisfies` so ids stay a literal union generated from the keys.
const definitions = {
  // Emotes -----------------------------------------------------------------
  content: {
    channel: 'emote',
    label: 'Content',
    meaning: 'Relaxed, warm, quietly happy to be here.',
    useWhen: 'A pleasant moment, a friendly greeting, settling after a reaction.',
    avoidWhen: 'Something genuinely surprising or worth a bigger reaction happened.',
    intensity: { min: 0.2, max: 0.8, default: 0.5 },
    duration: 2.2,
    layersWith: face,
    priority: 1,
    similar: ['amused'],
    selectable: true,
  },
  amused: {
    channel: 'emote',
    label: 'Amused',
    meaning: 'Finds something funny; a chuckle rather than a big laugh.',
    useWhen: 'A joke, a silly moment, a harmless blunder.',
    avoidWhen: 'The streamer is frustrated or something actually went wrong for them.',
    intensity: { min: 0.2, max: 1, default: 0.6 },
    duration: 2,
    layersWith: face,
    priority: 2,
    similar: ['content', 'teasing'],
    selectable: true,
  },
  excited: {
    channel: 'emote',
    label: 'Excited',
    meaning: 'Bright, energised anticipation or delight.',
    useWhen: 'Something good is about to happen or just happened; hype moments.',
    avoidWhen: 'Routine actions. Do not hype every small thing.',
    intensity: { min: 0.3, max: 1, default: 0.7 },
    duration: 2.2,
    layersWith: face,
    priority: 3,
    similar: ['impressed', 'amused'],
    selectable: true,
  },
  proud: {
    channel: 'emote',
    label: 'Proud',
    meaning: 'Proud of the streamer or of itself; chin up.',
    useWhen: 'A hard-earned success, a comeback, a goal reached together.',
    avoidWhen: 'Easy wins or the streamer boasting about something trivial.',
    intensity: { min: 0.3, max: 1, default: 0.6 },
    duration: 2.4,
    layersWith: face,
    priority: 3,
    similar: ['impressed', 'content'],
    selectable: true,
  },
  impressed: {
    channel: 'emote',
    label: 'Impressed',
    meaning: 'Restrained approval: that was actually good.',
    useWhen: 'Genuine skill or a clever move. Lets real achievements land without gushing.',
    avoidWhen: 'Obvious boasting or mediocre results; prefer skeptical or teasing.',
    intensity: { min: 0.2, max: 1, default: 0.5 },
    duration: 2.2,
    layersWith: face,
    priority: 2,
    similar: ['proud', 'content'],
    selectable: true,
  },
  smug: {
    channel: 'emote',
    label: 'Smug',
    meaning: 'Self-satisfied, knowing look; "told you so".',
    useWhen: 'Tavi was right, or after landing a tease.',
    avoidWhen: 'The streamer is having a hard time.',
    intensity: { min: 0.2, max: 0.9, default: 0.5 },
    duration: 2.2,
    layersWith: face,
    priority: 2,
    similar: ['teasing', 'skeptical'],
    selectable: true,
  },
  teasing: {
    channel: 'emote',
    label: 'Teasing',
    meaning: 'Affectionate, playful ribbing.',
    useWhen: 'Extended boasting, an obvious excuse, a playful running joke.',
    avoidWhen: 'Genuine frustration, sensitive topics, or when it would pile on a real failure.',
    intensity: { min: 0.2, max: 0.9, default: 0.5 },
    duration: 2.2,
    layersWith: face,
    priority: 2,
    similar: ['smug', 'amused'],
    selectable: true,
  },
  skeptical: {
    channel: 'emote',
    label: 'Skeptical',
    meaning: 'Doubtful side-eye: "really?"',
    useWhen: 'An obvious excuse, a tall claim, "that was intentional" after a mistake.',
    avoidWhen: 'Sincere statements or genuine achievements.',
    intensity: { min: 0.2, max: 1, default: 0.6 },
    duration: 2.6,
    layersWith: face,
    priority: 2,
    similar: ['thinking', 'smug'],
    selectable: true,
  },
  confused: {
    channel: 'emote',
    label: 'Confused',
    meaning: 'Puzzled, not following.',
    useWhen: 'Something makes no sense or the streamer says something cryptic.',
    avoidWhen: 'Tavi could plausibly understand; do not feign confusion to dodge a reaction.',
    intensity: { min: 0.2, max: 0.9, default: 0.5 },
    duration: 2.2,
    layersWith: face,
    priority: 2,
    similar: ['thinking', 'skeptical'],
    selectable: true,
  },
  thinking: {
    channel: 'emote',
    label: 'Thinking',
    meaning: 'Mulling it over, considering.',
    useWhen: 'A question was asked, a decision is pending, or Tavi is working out a response.',
    avoidWhen: 'An instant reaction is clearly called for.',
    intensity: { min: 0.2, max: 0.9, default: 0.5 },
    duration: 2.4,
    layersWith: face,
    priority: 1,
    similar: ['skeptical', 'confused'],
    selectable: true,
  },
  sympathetic: {
    channel: 'emote',
    label: 'Sympathetic',
    meaning: 'Gentle, supportive "aw, that is rough".',
    useWhen: 'Bad luck, a frustrating loss, the streamer sounds tired or down.',
    avoidWhen: 'The setback is self-inflicted and being joked about; amused fits better then.',
    intensity: { min: 0.2, max: 0.8, default: 0.5 },
    duration: 2.6,
    layersWith: face,
    priority: 2,
    similar: ['content', 'thinking'],
    selectable: true,
  },
  embarrassed: {
    channel: 'emote',
    label: 'Embarrassed',
    meaning: 'Flustered or shy; caught off guard by attention.',
    useWhen: 'Tavi is complimented, called out, or noticed doing something silly.',
    avoidWhen: 'Tavi is not the subject of the moment.',
    intensity: { min: 0.2, max: 0.9, default: 0.5 },
    duration: 2.2,
    layersWith: face,
    priority: 2,
    similar: ['innocent', 'content'],
    selectable: true,
  },
  innocent: {
    channel: 'emote',
    label: 'Innocent',
    meaning: '"Wasn\'t me." Caught, feigning innocence.',
    useWhen: 'Tavi is blamed or caught, or as the punchline after a tease.',
    avoidWhen: 'A serious accusation or a real problem.',
    intensity: { min: 0.2, max: 0.9, default: 0.6 },
    duration: 2.6,
    layersWith: face,
    priority: 2,
    similar: ['embarrassed', 'amused'],
    selectable: true,
  },
  bored: {
    channel: 'emote',
    label: 'Bored',
    meaning: 'Unimpressed, waiting for something to happen.',
    useWhen: 'Long downtime, repeated boasting, or as a deliberate comedic contrast.',
    avoidWhen: 'The streamer is doing something they care about; never undercut real effort.',
    intensity: { min: 0.2, max: 0.7, default: 0.4 },
    duration: 2.6,
    layersWith: face,
    priority: 1,
    similar: ['thinking', 'skeptical'],
    selectable: true,
  },
  startled: {
    channel: 'emote',
    label: 'Startled',
    meaning: 'A quick jolt of surprise.',
    useWhen: 'A sudden event, jump scare, unexpected twist, or loud moment.',
    avoidWhen: 'Expected or slow-building events.',
    intensity: { min: 0.3, max: 1, default: 0.7 },
    duration: 1.2,
    layersWith: face,
    priority: 4,
    similar: ['excited', 'confused'],
    selectable: true,
  },
  // Facial emotes (mostly face; small body accents) ---------------------------
  'soft-smile': {
    channel: 'emote',
    label: 'Soft smile',
    meaning: 'A small, warm, closed-mouth smile with relaxed eyes. Quietly pleased.',
    useWhen: 'A sweet or wholesome moment, a kind word from chat, settling after a tease.',
    avoidWhen: 'Something genuinely funny (amused or laugh) or exciting (grin or excited).',
    intensity: { min: 0.2, max: 0.8, default: 0.5 },
    duration: 2.4,
    layersWith: face,
    priority: 1,
    similar: ['content', 'amused'],
    selectable: true,
  },
  grin: {
    channel: 'emote',
    label: 'Grin',
    meaning: 'A big, wide, toothy-feeling grin: delighted and a little mischievous.',
    useWhen: 'A clever play, a plan coming together, good news Tavi is genuinely happy about.',
    avoidWhen: 'Routine moments, or when the streamer is frustrated.',
    intensity: { min: 0.3, max: 1, default: 0.7 },
    duration: 2,
    layersWith: face,
    priority: 2,
    similar: ['excited', 'amused'],
    selectable: true,
  },
  laugh: {
    channel: 'emote',
    label: 'Laugh',
    meaning: 'Laughing out loud: eyes squeezed shut, mouth wide, bouncing.',
    useWhen: 'Something is genuinely hilarious: a great joke, a spectacular harmless fail.',
    avoidWhen:
      'The streamer is upset or the fail cost them something real. Use amused for a chuckle; overusing laugh makes it hollow.',
    intensity: { min: 0.4, max: 1, default: 0.8 },
    duration: 1.8,
    layersWith: face,
    priority: 3,
    similar: ['amused', 'grin'],
    selectable: true,
  },
  smirk: {
    channel: 'emote',
    label: 'Smirk',
    meaning: 'A lopsided half-smile with one brow up: "heh, nice try" or "I know something".',
    useWhen: 'A quick knowing reaction, landing a tease, catching an obvious bluff.',
    avoidWhen: 'Sincere moments or real setbacks. For a longer self-satisfied look use smug.',
    intensity: { min: 0.2, max: 1, default: 0.6 },
    duration: 1.8,
    layersWith: face,
    priority: 2,
    similar: ['smug', 'teasing'],
    selectable: true,
  },
  'eye-roll': {
    channel: 'emote',
    label: 'Eye roll',
    meaning: 'Rolls the eyes up and across with heavy lids: "oh, come on".',
    useWhen:
      'Playful exasperation at extended boasting, a terrible pun or an obvious excuse. The "aiit bro, ntm" look.',
    avoidWhen: 'Genuine achievements or anyone being sincere; it is dismissive.',
    intensity: { min: 0.3, max: 1, default: 0.7 },
    duration: 1.6,
    layersWith: face,
    priority: 2,
    similar: ['bored', 'skeptical'],
    selectable: true,
  },
  suspicious: {
    channel: 'emote',
    label: 'Suspicious',
    meaning: 'Narrowed, heavy-lidded side-eye: "hmm, what are you up to?"',
    useWhen: 'Something sounds too good to be true, chat is plotting, a sneaky play.',
    avoidWhen: 'A plain doubtful "really?" (skeptical) or anything sincere.',
    intensity: { min: 0.2, max: 1, default: 0.6 },
    duration: 2.4,
    layersWith: face,
    priority: 2,
    similar: ['skeptical', 'thinking'],
    selectable: true,
  },
  deadpan: {
    channel: 'emote',
    label: 'Deadpan',
    meaning: 'Flat, expressionless stare with a slow blink. Dry comedic non-reaction.',
    useWhen:
      'Comedic timing: right after a terrible joke, an obvious statement, or a bit that did not land.',
    avoidWhen: 'Moments that deserve warmth or a real reaction; it reads as cold if overused.',
    intensity: { min: 0.3, max: 1, default: 0.7 },
    duration: 2.2,
    layersWith: face,
    priority: 2,
    similar: ['bored', 'skeptical'],
    selectable: true,
  },
  focused: {
    channel: 'emote',
    label: 'Focused',
    meaning: 'Concentrating hard: brows down, eyes steady, mouth set. Locked in.',
    useWhen: 'A tense clutch moment, a hard puzzle, watching closely while the streamer plays.',
    avoidWhen: 'Casual chatting or anything light-hearted.',
    intensity: { min: 0.2, max: 1, default: 0.6 },
    duration: 2.8,
    layersWith: face,
    priority: 2,
    similar: ['thinking', 'determined'],
    selectable: true,
  },
  determined: {
    channel: 'emote',
    label: 'Determined',
    meaning: 'Fired up and resolved: lowered brows, set jaw, a firm nod. "Let\'s do this."',
    useWhen: 'Before a hard attempt, after a loss when trying again, rallying the streamer.',
    avoidWhen: 'Relaxed moments or when the streamer wants to stop.',
    intensity: { min: 0.3, max: 1, default: 0.7 },
    duration: 2,
    layersWith: face,
    priority: 2,
    similar: ['focused', 'proud'],
    selectable: true,
  },
  frown: {
    channel: 'emote',
    label: 'Frown',
    meaning: 'Mild displeasure: brows lowered, mouth turned down. "Not great."',
    useWhen: 'Something mildly bad or unfair happens, a disliked opinion, a lag spike.',
    avoidWhen:
      'Real distress (sympathetic or sad fit better) or playful moments. Never frown at a viewer.',
    intensity: { min: 0.2, max: 0.9, default: 0.5 },
    duration: 2,
    layersWith: face,
    priority: 2,
    similar: ['annoyed', 'sad'],
    selectable: true,
  },
  pout: {
    channel: 'emote',
    label: 'Pout',
    meaning: 'A small, sulky pout, looking away. Playfully put out, not actually upset.',
    useWhen: 'Tavi is teased back, ignored, denied something small, or loses a playful argument.',
    avoidWhen: 'Serious moments; a pout about a real problem looks petty.',
    intensity: { min: 0.2, max: 0.9, default: 0.6 },
    duration: 2.2,
    layersWith: face,
    priority: 2,
    similar: ['frown', 'embarrassed'],
    selectable: true,
  },
  annoyed: {
    channel: 'emote',
    label: 'Annoyed',
    meaning: 'Irritated: heavy lids, lowered brows, mouth pulled flat to one side.',
    useWhen: 'Repeated spam, the same mistake again, a game mechanic being unfair. Mock-annoyance.',
    avoidWhen:
      'Never aim it at a viewer or the streamer in earnest. Keep it playful and brief; it is the strongest negative emote.',
    intensity: { min: 0.2, max: 0.9, default: 0.5 },
    duration: 2,
    layersWith: face,
    priority: 2,
    similar: ['frown', 'skeptical'],
    selectable: true,
  },
  sad: {
    channel: 'emote',
    label: 'Sad',
    meaning: 'Downcast: raised brows, heavy eyes, mouth turned down, looking down.',
    useWhen: 'A heartfelt loss, a goodbye, a sad story moment in a game.',
    avoidWhen:
      'Small setbacks (frown or sympathetic) or anything comedic. Sympathetic is better when supporting the streamer.',
    intensity: { min: 0.2, max: 0.9, default: 0.5 },
    duration: 2.6,
    layersWith: face,
    priority: 2,
    similar: ['sympathetic', 'frown'],
    selectable: true,
  },
  worried: {
    channel: 'emote',
    label: 'Worried',
    meaning: 'Anxious and uneasy: brows up, tight wavering mouth, glancing around.',
    useWhen: 'Low health, a risky play, a timer running out, a jump-scare game building up.',
    avoidWhen: 'The danger already passed (relief or amused) or a sudden event (startled).',
    intensity: { min: 0.2, max: 1, default: 0.6 },
    duration: 2.4,
    layersWith: face,
    priority: 2,
    similar: ['sympathetic', 'thinking'],
    selectable: true,
  },
  wince: {
    channel: 'emote',
    label: 'Wince',
    meaning: 'A sharp "ouch": eyes squeezed, mouth pulled tight, head flinching back.',
    useWhen: 'A painful-looking fail, a brutal hit in game, second-hand embarrassment.',
    avoidWhen:
      'Real injuries or distress. Pair with sympathetic, not laugh, if it hurt the streamer.',
    intensity: { min: 0.3, max: 1, default: 0.7 },
    duration: 1.4,
    layersWith: face,
    priority: 3,
    similar: ['startled', 'embarrassed'],
    selectable: true,
  },
  'grossed-out': {
    channel: 'emote',
    label: 'Grossed out',
    meaning: 'Disgust: nose-wrinkled squint, mouth pulled down to one side, recoiling.',
    useWhen: 'Something gross on screen, a cursed food take, a horrible in-game sight.',
    avoidWhen: "Never at a person, their appearance or anyone's genuine preferences.",
    intensity: { min: 0.3, max: 1, default: 0.7 },
    duration: 1.8,
    layersWith: face,
    priority: 3,
    similar: ['wince', 'annoyed'],
    selectable: true,
  },
  shocked: {
    channel: 'emote',
    label: 'Shocked',
    meaning: 'Jaw-dropped disbelief that holds: brows high, mouth wide, frozen stare.',
    useWhen: 'An unbelievable twist, a ridiculous outcome, chat revealing something wild.',
    avoidWhen: 'A quick jolt (startled) or small surprises. Overusing it flattens real moments.',
    intensity: { min: 0.4, max: 1, default: 0.8 },
    duration: 1.8,
    layersWith: face,
    priority: 4,
    similar: ['startled', 'confused'],
    selectable: true,
  },
  sleepy: {
    channel: 'emote',
    label: 'Sleepy',
    meaning: 'Drowsy: heavy drooping lids, slow blinks, head lolling; at strong intensity a yawn.',
    useWhen: 'Late-night streams, long quiet stretches, a slow loading screen, being told to rest.',
    avoidWhen:
      'While the streamer is doing something they care about; it can read as boredom with them.',
    intensity: { min: 0.2, max: 1, default: 0.5 },
    duration: 3,
    layersWith: face,
    priority: 1,
    similar: ['bored', 'content'],
    selectable: true,
  },
  blush: {
    channel: 'emote',
    label: 'Blush',
    meaning: 'Bashfully pleased: a shy closed-eye smile, head tucked, hand behind the head.',
    useWhen: 'A sincere compliment to Tavi, a sweet message from chat, being thanked.',
    avoidWhen:
      'Being called out or caught (embarrassed or innocent fit better). Not for teasing back.',
    intensity: { min: 0.2, max: 1, default: 0.6 },
    duration: 2.2,
    layersWith: face,
    priority: 2,
    similar: ['embarrassed', 'soft-smile'],
    selectable: true,
  },
  // Gestures -----------------------------------------------------------------
  wave: {
    channel: 'gesture',
    label: 'Wave',
    meaning: 'A friendly hello or goodbye wave.',
    useWhen: 'Greeting the streamer or a viewer, saying goodbye, being clicked.',
    avoidWhen: 'Mid-conversation with no greeting involved.',
    intensity: { min: 0.3, max: 1, default: 0.7 },
    duration: 2,
    layersWith: body,
    priority: 3,
    similar: ['agreeing'],
    selectable: true,
  },
  celebrate: {
    channel: 'gesture',
    label: 'Celebrate',
    meaning: 'Big, joyful celebration.',
    useWhen: 'A real, hard-earned victory or milestone.',
    avoidWhen: 'Small or routine successes; overuse makes it meaningless.',
    intensity: { min: 0.4, max: 1, default: 0.8 },
    duration: 2.2,
    layersWith: body,
    priority: 4,
    similar: ['agreeing'],
    selectable: true,
  },
  agreeing: {
    channel: 'gesture',
    label: 'Agreeing',
    meaning: 'A nod: yes, fair enough, I am with you.',
    useWhen: 'Agreeing, acknowledging a point, or an exaggerated nod after a skeptical look.',
    avoidWhen: 'Tavi actually disagrees; do not agree automatically.',
    intensity: { min: 0.2, max: 1, default: 0.5 },
    duration: 1.6,
    layersWith: body,
    priority: 2,
    similar: [],
    selectable: true,
  },
  disagreeing: {
    channel: 'gesture',
    label: 'Disagreeing',
    meaning: 'A head shake: no, not buying it.',
    useWhen: 'Rejecting a tall claim, a bad idea, or a playful "nope".',
    avoidWhen: 'Sincere feelings or achievements.',
    intensity: { min: 0.2, max: 1, default: 0.5 },
    duration: 1.6,
    layersWith: body,
    priority: 2,
    similar: [],
    selectable: true,
  },
  shrug: {
    channel: 'gesture',
    label: 'Shrug',
    meaning: '"Who knows?" or "eh, whatever."',
    useWhen: 'Uncertainty, indifference, or a question Tavi cannot answer.',
    avoidWhen: 'The streamer wants support or a clear reaction.',
    intensity: { min: 0.2, max: 1, default: 0.5 },
    duration: 1.6,
    layersWith: body,
    priority: 2,
    similar: [],
    selectable: true,
  },
  point: {
    channel: 'gesture',
    label: 'Point',
    meaning: 'Points toward the attention target.',
    useWhen: 'Calling attention to chat, the streamer, or something on screen.',
    avoidWhen: 'There is no clear target.',
    intensity: { min: 0.3, max: 1, default: 0.6 },
    duration: 1.6,
    layersWith: body,
    priority: 2,
    similar: [],
    selectable: true,
  },
  sassy: {
    channel: 'gesture',
    label: 'Hands on hips',
    meaning: 'Hands-on-hips stance: unimpressed, mock-stern, or "excuse me?"',
    useWhen: 'Playful scolding, waiting for an explanation, supporting skeptical or teasing.',
    avoidWhen: 'Warm or supportive moments.',
    intensity: { min: 0.2, max: 1, default: 0.5 },
    duration: 2.2,
    layersWith: body,
    priority: 2,
    similar: ['shrug'],
    selectable: true,
  },
  // Attention -----------------------------------------------------------------
  listening: {
    channel: 'attention',
    label: 'Listening',
    meaning: 'Attentive: turned toward the speaker, taking it in.',
    useWhen: 'While someone is talking to Tavi or while waiting for the point of a story.',
    avoidWhen: 'Nobody is addressing Tavi.',
    intensity: { min: 0.2, max: 1, default: 0.6 },
    duration: 2.4,
    layersWith: everything,
    priority: 2,
    similar: ['glance'],
    selectable: true,
  },
  glance: {
    channel: 'attention',
    label: 'Glance',
    meaning: 'A quick look toward the target, then back.',
    useWhen: 'Noticing chat, checking on the streamer, a beat before reacting.',
    avoidWhen: 'A sustained reaction is needed.',
    intensity: { min: 0.2, max: 1, default: 0.5 },
    duration: 1,
    layersWith: everything,
    priority: 1,
    similar: ['listening'],
    selectable: true,
  },
  'look-away': {
    channel: 'attention',
    label: 'Look away',
    meaning: 'Pointedly looks away: "I did not see that" or mock aloofness.',
    useWhen: 'Comedic avoidance, after a tease, being caught.',
    avoidWhen: "Someone sincerely wants Tavi's attention.",
    intensity: { min: 0.2, max: 1, default: 0.5 },
    duration: 1.6,
    layersWith: everything,
    priority: 2,
    similar: ['glance'],
    selectable: true,
  },
  // Presence -----------------------------------------------------------------
  peek: {
    channel: 'presence',
    label: 'Peek',
    meaning: 'Shyly peeks in from the edge of the screen.',
    useWhen: 'Shy entrances, curiosity, checking in without interrupting.',
    avoidWhen: 'Tavi should be front and centre for a big reaction.',
    intensity: { min: 0.3, max: 1, default: 0.7 },
    duration: 2.6,
    layersWith: ['emote', 'attention'],
    priority: 2,
    similar: ['glance'],
    selectable: true,
  },
  // Idle life (renderer-scheduled, never AI-selected) -------------------------
  'idle-glance': {
    channel: 'idle',
    label: 'Idle glance',
    meaning: 'Absent-minded look around.',
    useWhen: 'Scheduled occasionally while nothing else is happening.',
    avoidWhen: 'Quiet mode, retracted, or any active reaction.',
    intensity: { min: 0.1, max: 0.5, default: 0.3 },
    duration: 1.4,
    layersWith: everything,
    priority: 1,
    similar: [],
    selectable: false,
  },
  'idle-fidget': {
    channel: 'idle',
    label: 'Idle fidget',
    meaning: 'A small posture shift or sway.',
    useWhen: 'Scheduled occasionally while nothing else is happening.',
    avoidWhen: 'Quiet mode, retracted, or any active reaction.',
    intensity: { min: 0.1, max: 0.5, default: 0.3 },
    duration: 1.8,
    layersWith: everything,
    priority: 1,
    similar: [],
    selectable: false,
  },
} as const satisfies Record<
  string,
  Omit<ExpressionDefinition, 'similar'> & { similar: readonly string[] }
>;

export type ExpressionId = keyof typeof definitions;
export const expressionIds = Object.keys(definitions) as [ExpressionId, ...ExpressionId[]];
export const expressionIdSchema = z.enum(expressionIds);
export const expressions: Record<ExpressionId, ExpressionDefinition> = definitions;
export const selectableExpressionIds = expressionIds.filter((id) => expressions[id].selectable);

// Sequences ("beats") chain expressions into a readable moment. Offsets and holds are seconds.
export interface SequenceStep {
  expression: ExpressionId;
  offset: number;
  hold: number;
  intensity?: number;
}
export interface SequenceDefinition {
  label: string;
  meaning: string;
  useWhen: string;
  steps: readonly SequenceStep[];
}
const sequenceDefinitions = {
  'doubt-then-nod': {
    label: 'Doubt, then nod',
    meaning: 'Skeptical side-eye followed by an exaggerated, unconvinced nod.',
    useWhen: '"That was intentional" after an obvious mistake.',
    steps: [
      { expression: 'skeptical', offset: 0, hold: 1.6, intensity: 0.7 },
      { expression: 'agreeing', offset: 1.7, hold: 1.4, intensity: 0.9 },
    ],
  },
  'caught-innocent': {
    label: 'Caught!',
    meaning: 'Startled at being noticed, then "wasn\'t me".',
    useWhen: 'Tavi is blamed or caught out.',
    steps: [
      { expression: 'startled', offset: 0, hold: 0.6, intensity: 0.6 },
      { expression: 'innocent', offset: 0.6, hold: 2, intensity: 0.7 },
      { expression: 'look-away', offset: 0.9, hold: 1.4, intensity: 0.5 },
    ],
  },
  greeting: {
    label: 'Greeting',
    meaning: 'Notices someone, waves, settles into a warm look.',
    useWhen: 'Someone says hi or arrives.',
    steps: [
      { expression: 'glance', offset: 0, hold: 0.5, intensity: 0.6 },
      { expression: 'wave', offset: 0.4, hold: 1.8, intensity: 0.8 },
      { expression: 'content', offset: 0.6, hold: 2, intensity: 0.5 },
    ],
  },
  'big-win': {
    label: 'Big win',
    meaning: 'A jolt, a full celebration, then a proud glow.',
    useWhen: 'A genuine, hard-earned victory.',
    steps: [
      { expression: 'startled', offset: 0, hold: 0.4, intensity: 0.5 },
      { expression: 'celebrate', offset: 0.4, hold: 2, intensity: 0.9 },
      { expression: 'proud', offset: 2.4, hold: 1.8, intensity: 0.7 },
    ],
  },
  'restrained-approval': {
    label: 'Restrained approval',
    meaning: 'A small impressed look and a single nod. Lets a good moment land without gushing.',
    useWhen: 'Solid play or a good point that does not merit a celebration.',
    steps: [
      { expression: 'impressed', offset: 0, hold: 1.8, intensity: 0.5 },
      { expression: 'agreeing', offset: 0.5, hold: 1.2, intensity: 0.4 },
    ],
  },
  'not-buying-it': {
    label: 'Not buying it',
    meaning: 'Skeptical look, hands on hips, a slow head shake.',
    useWhen: 'A tall tale or extended boasting.',
    steps: [
      { expression: 'skeptical', offset: 0, hold: 1.8, intensity: 0.7 },
      { expression: 'sassy', offset: 0.3, hold: 2, intensity: 0.6 },
      { expression: 'disagreeing', offset: 1.4, hold: 1.2, intensity: 0.6 },
    ],
  },
  'gentle-tease': {
    label: 'Gentle tease',
    meaning: 'A smug look that turns into a playful tease.',
    useWhen: 'Affectionate ribbing after boasting; the "aiit bro, ntm" moment.',
    steps: [
      { expression: 'smug', offset: 0, hold: 1.4, intensity: 0.5 },
      { expression: 'teasing', offset: 1.3, hold: 1.8, intensity: 0.6 },
    ],
  },
  'mull-it-over': {
    label: 'Mull it over',
    meaning: 'Thinks about it, then agrees.',
    useWhen: 'A question or suggestion Tavi ends up liking.',
    steps: [
      { expression: 'thinking', offset: 0, hold: 1.8, intensity: 0.6 },
      { expression: 'agreeing', offset: 1.8, hold: 1.2, intensity: 0.5 },
    ],
  },
  'roll-then-smirk': {
    label: 'Eye roll, then smirk',
    meaning: 'An exaggerated eye roll that settles into a knowing smirk.',
    useWhen: 'Extended boasting or a groan-worthy pun; the affectionate "aiit bro, ntm".',
    steps: [
      { expression: 'eye-roll', offset: 0, hold: 1.3, intensity: 0.7 },
      { expression: 'smirk', offset: 1.3, hold: 1.6, intensity: 0.6 },
    ],
  },
  'shock-then-laugh': {
    label: 'Shock, then laugh',
    meaning: 'Jaw-dropped disbelief that breaks into laughter.',
    useWhen: 'A spectacular, harmless fail or an absurd twist.',
    steps: [
      { expression: 'shocked', offset: 0, hold: 1, intensity: 0.8 },
      { expression: 'laugh', offset: 1, hold: 1.8, intensity: 0.8 },
    ],
  },
  'there-there': {
    label: 'There, there',
    meaning: 'Listens closely, then offers a sympathetic look.',
    useWhen: 'Bad luck or the streamer venting.',
    steps: [
      { expression: 'listening', offset: 0, hold: 1.4, intensity: 0.6 },
      { expression: 'sympathetic', offset: 0.8, hold: 2.4, intensity: 0.6 },
    ],
  },
} as const satisfies Record<string, SequenceDefinition>;
export type SequenceId = keyof typeof sequenceDefinitions;
export const sequenceIds = Object.keys(sequenceDefinitions) as [SequenceId, ...SequenceId[]];
export const sequenceIdSchema = z.enum(sequenceIds);
export const sequences: Record<SequenceId, SequenceDefinition> = sequenceDefinitions;

export function isExpressionId(value: string): value is ExpressionId {
  return Object.hasOwn(definitions, value);
}
export function isSequenceId(value: string): value is SequenceId {
  return Object.hasOwn(sequenceDefinitions, value);
}
export function clampIntensity(id: ExpressionId, value: number | undefined) {
  const range = expressions[id].intensity;
  const raw = value === undefined || !Number.isFinite(value) ? range.default : value;
  return Math.min(range.max, Math.max(range.min, raw));
}
/** Whether two expressions may play at the same time. Same channel never layers. */
export function canLayer(a: ExpressionId, b: ExpressionId) {
  const first = expressions[a],
    second = expressions[b];
  if (first.channel === second.channel) return false;
  return first.layersWith.includes(second.channel) || second.layersWith.includes(first.channel);
}
