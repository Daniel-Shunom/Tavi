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
