import type { ReactNode } from 'react';
import { Check, CircleAlert, Cloud, Eye, Hand, MessageCircle, Smile, Sparkles } from 'lucide-react';
import { supportedSequences, type CharacterCapabilities } from '../../shared/capabilities';
import type { ExpressionId, SequenceId, Target } from '../../shared/expressions';

// Small pieces every Studio screen (and the OBS dock) shares: the reactions a streamer fires,
// a switch, a segmented choice and a card.

export type Cue = { expression: ExpressionId } | { sequence: SequenceId };

/** The quick reactions, in hotkey order (1–8), offered when the character supports them. */
export const quickCues: {
  cue: Cue;
  label: string;
  doing: string;
  icon: ReactNode;
  target?: Target;
}[] = [
  { cue: { sequence: 'greeting' }, label: 'Wave', doing: 'Waving', icon: <Hand /> },
  { cue: { sequence: 'big-win' }, label: 'Celebrate', doing: 'Celebrating', icon: <Sparkles /> },
  { cue: { sequence: 'restrained-approval' }, label: 'Nice', doing: 'Approving', icon: <Check /> },
  {
    cue: { sequence: 'doubt-then-nod' },
    label: 'Really?',
    doing: 'Doubting',
    icon: <CircleAlert />,
  },
  {
    cue: { sequence: 'caught-innocent' },
    label: 'Oops',
    doing: 'Acting innocent',
    icon: <Cloud />,
  },
  {
    cue: { expression: 'listening' },
    label: 'Listen',
    doing: 'Listening to you',
    icon: <Eye />,
    target: 'streamer',
  },
  // Looks at the real chat panel from the scene layout (shared/attention.ts).
  {
    cue: { expression: 'glance' },
    label: 'Look at chat',
    doing: 'Looking at chat',
    icon: <MessageCircle />,
    target: 'chat',
  },
  { cue: { expression: 'peek' }, label: 'Peek', doing: 'Peeking', icon: <Smile /> },
];

export function supports(character: CharacterCapabilities | undefined, cue: Cue) {
  if (!character) return false;
  return 'sequence' in cue
    ? supportedSequences(character).includes(cue.sequence)
    : character.expressions.includes(cue.expression);
}

/** True while the visitor is typing, so hotkeys never steal a keystroke. */
export function typing(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

export const natures = {
  cozy: { label: 'Cozy', line: 'Warm, calm, quietly present.' },
  playful: { label: 'Playful', line: 'A little cheek. A lot of character.' },
  shy: { label: 'Shy', line: 'Gentle, observant, taking it all in.' },
} as const;

export function Switch({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      className="st-switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        onChange(!checked);
      }}
    />
  );
}

/** A row with a title, a short explanation and a switch. */
export function SwitchRow({
  title,
  detail,
  ...control
}: {
  title: string;
  detail?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="st-row">
      <div>
        <b>{title}</b>
        {detail ? <span>{detail}</span> : null}
      </div>
      <Switch label={title} {...control} />
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  disabled,
  onPick,
}: {
  label: string;
  options: readonly { id: T; label: string }[];
  value: T;
  disabled?: boolean;
  onPick: (value: T) => void;
}) {
  return (
    <div
      className="st-seg"
      role="radiogroup"
      aria-label={label}
      style={{ gridTemplateColumns: `repeat(${String(options.length)}, minmax(0, 1fr))` }}
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={option.id === value}
          disabled={disabled}
          onClick={() => {
            onPick(option.id);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Card({
  title,
  aside,
  children,
  className = '',
  label,
}: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <section className={`st-card ${className}`} aria-label={label}>
      {title || aside ? (
        <div className="st-card-head">
          {title ? <h2>{title}</h2> : <span />}
          {aside}
        </div>
      ) : null}
      {children}
    </section>
  );
}
