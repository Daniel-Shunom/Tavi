// Deterministic, keyword-based decisions. The default provider and the fallback when an AI
// provider is unconfigured, over budget, slow or failing. Never presented as AI.
import { supportedSequences } from '../../shared/capabilities.js';
import type { Decision } from '../../shared/decision.js';
import type { SequenceId } from '../../shared/expressions.js';
import type { DecisionContext, DecisionProvider } from './types.js';

type Intent =
  'greeting' | 'win' | 'boast' | 'setback' | 'question' | 'laugh' | 'blame' | 'thanks' | 'other';
const patterns: [Intent, RegExp][] = [
  ['blame', /\b(your fault|tavi did|blame (you|tavi)|was (it )?you)\b/i],
  [
    'boast',
    /\b(intentional|on purpose|meant to|too easy|so easy|i'?m (the best|cracked|goated)|obviously|ez)\b/i,
  ],
  ['win', /\b(won|win|victory|gg|we did it|finally|clutch|beat (it|the boss)|first try)\b/i],
  ['setback', /\b(died|dead|lost|lose|ugh|rip|tired|unlucky|so bad|missed|failed|again\?)\b/i],
  ['greeting', /\b(hi|hello|hey|hiya|yo|good (morning|evening)|welcome|bye|goodnight)\b/i],
  ['thanks', /\b(thanks|thank you|ty|appreciate)\b/i],
  ['laugh', /\b(lol|lmao|haha+|rofl|funny|xd)\b/i],
];
/** Plain requests from the streamer for a body state. Chat cannot command states. */
const stateRequests: [NonNullable<Decision['state']>, RegExp][] = [
  ['nap', /\b(take a nap|nap time|go (to )?sleep|have a nap|get some sleep)\b/i],
  ['peek', /\b(check (the )?chat|look at (the )?chat|read (the )?chat|peek at (the )?chat)\b/i],
  ['perch', /\b(perch|hop up|on top of (the )?(cam|webcam|camera))\b/i],
  ['lean', /\b(lean (on|against)|lean back)\b/i],
  ['sit', /\b(sit down|have a seat|take a seat|sit on)\b/i],
  ['stand', /\b(stand up|get up|wake up|rise and shine)\b/i],
];
export function stateRequest(text: string): NonNullable<Decision['state']> | null {
  for (const [state, pattern] of stateRequests) if (pattern.test(text)) return state;
  return null;
}
export function classify(text: string): Intent {
  for (const [intent, pattern] of patterns) if (pattern.test(text)) return intent;
  return text.trim().endsWith('?') ? 'question' : 'other';
}
const byAttitude: Record<Intent, Record<DecisionContext['persona']['attitude'], SequenceId[]>> = {
  greeting: { gentle: ['greeting'], cheeky: ['greeting'], spicy: ['greeting'] },
  win: {
    gentle: ['big-win', 'restrained-approval'],
    cheeky: ['big-win', 'restrained-approval'],
    spicy: ['restrained-approval', 'big-win'],
  },
  boast: {
    gentle: ['mull-it-over', 'restrained-approval'],
    cheeky: ['doubt-then-nod', 'gentle-tease'],
    spicy: ['not-buying-it', 'gentle-tease'],
  },
  setback: {
    gentle: ['there-there'],
    cheeky: ['there-there', 'mull-it-over'],
    spicy: ['gentle-tease', 'there-there'],
  },
  question: { gentle: ['mull-it-over'], cheeky: ['mull-it-over'], spicy: ['mull-it-over'] },
  laugh: { gentle: ['restrained-approval'], cheeky: ['gentle-tease'], spicy: ['gentle-tease'] },
  blame: { gentle: ['caught-innocent'], cheeky: ['caught-innocent'], spicy: ['caught-innocent'] },
  thanks: { gentle: ['greeting'], cheeky: ['restrained-approval'], spicy: ['restrained-approval'] },
  other: { gentle: [], cheeky: [], spicy: [] },
};
const captions: Partial<
  Record<SequenceId, Record<DecisionContext['persona']['attitude'], string>>
> = {
  'doubt-then-nod': { gentle: 'Sure, sure.', cheeky: 'Okay, superstar.', spicy: 'aiit bro, ntm' },
  'not-buying-it': { gentle: 'Hmm...', cheeky: 'Really?', spicy: 'aiit bro, ntm' },
  'caught-innocent': { gentle: "Wasn't me!", cheeky: "Wasn't me.", spicy: 'Prove it.' },
  'big-win': { gentle: 'You did it!', cheeky: 'There it is!', spicy: 'Finally!' },
  'gentle-tease': { gentle: 'Hehe.', cheeky: 'Mhm.', spicy: 'Sure you did.' },
};

export class RulesProvider implements DecisionProvider {
  readonly info = { id: 'rules', kind: 'rules', label: 'Rules (not AI)' } as const;
  private last: SequenceId | null = null;
  decide(context: DecisionContext): Promise<Decision> {
    const { persona, trigger, character } = context;
    if (trigger.source === 'streamer') {
      const state = stateRequest(trigger.text);
      if (state)
        return Promise.resolve({
          react: true,
          reason: `Rule: streamer asked for ${state}`,
          sequence: null,
          caption: '',
          target: 'streamer',
          beats: [],
          move: null,
          state,
        });
    }
    const available = new Set(supportedSequences(character));
    const intent = classify(trigger.text);
    let options = byAttitude[intent][persona.attitude].filter((id) => available.has(id));
    if (!options.length) {
      // Personality decides how Tavi treats otherwise unremarkable input.
      const fallback: Record<DecisionContext['persona']['personality'], SequenceId[]> = {
        cozy: ['there-there', 'mull-it-over'],
        playful: ['gentle-tease', 'greeting'],
        shy: ['caught-innocent', 'mull-it-over'],
      };
      if (persona.initiative === 'reserved' && trigger.source === 'chat')
        return Promise.resolve(none('Reserved initiative: nothing notable to react to.'));
      options = fallback[persona.personality].filter((id) => available.has(id));
    }
    // Avoid immediate repetition when there is a choice.
    const pick = options.find((id) => id !== this.last) ?? options[0];
    if (!pick) return Promise.resolve(none('No supported reaction fits.'));
    this.last = pick;
    const target = trigger.source === 'chat' ? 'chat' : 'streamer';
    const caption = captions[pick]?.[persona.attitude] ?? '';
    return Promise.resolve({
      react: true,
      reason: `Rule: ${intent} -> ${pick}`,
      sequence: pick,
      caption,
      target,
      beats: [],
      move: null,
    });
  }
}
function none(reason: string): Decision {
  return {
    react: false,
    reason,
    sequence: null,
    caption: '',
    target: 'neutral',
    beats: [],
    move: null,
  };
}
