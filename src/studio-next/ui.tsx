import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import { Slider } from '@base-ui/react/slider';
import { Switch } from '@base-ui/react/switch';
import { Check, Copy } from 'lucide-react';

// The new Studio's controls. Behaviour (focus, keys, roles) comes from Base UI; the look comes
// from studio-next.css and Studio's theme tokens.

/** Where drawers, dialogs and menus mount, so they sit inside the themed Studio root. It is the
 *  element itself (not a ref), so layers only render once it exists and never fall back to the
 *  page body, where the theme's colours are not defined. */
export const LayerContext = createContext<HTMLDivElement | null>(null);
export const useLayer = () => useContext(LayerContext);

/** A row with a title, a short explanation and a switch. The whole row is the target. */
export function ToggleRow({
  title,
  detail,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  detail?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="sn-row">
      <span>
        <b>{title}</b>
        {detail ? <span>{detail}</span> : null}
      </span>
      <Switch.Root
        className="sn-switch"
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      >
        <Switch.Thumb className="sn-switch-thumb" />
      </Switch.Root>
    </label>
  );
}

type Option<T extends string> = { id: T; label: string };

/** One choice of a few, with a pill that slides to the chosen one. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  disabled,
  onPick,
}: {
  label: string;
  options: readonly Option<T>[];
  value: T;
  disabled?: boolean;
  onPick: (value: T) => void;
}) {
  const index = Math.max(
    0,
    options.findIndex((option) => option.id === value),
  );
  return (
    <RadioGroup
      className="sn-seg"
      aria-label={label}
      value={value}
      disabled={disabled}
      style={{ '--n': options.length, '--i': index } as CSSProperties}
      onValueChange={(next) => {
        onPick(next);
      }}
    >
      <span className="sn-seg-pill" aria-hidden="true" />
      {options.map((option) => (
        <Radio.Root key={option.id} value={option.id} className="sn-seg-item">
          {option.label}
        </Radio.Root>
      ))}
    </RadioGroup>
  );
}

/** One choice of several, as wrapping chips. */
export function Choices<T extends string>({
  label,
  options,
  value,
  disabled,
  onPick,
}: {
  label: string;
  options: readonly Option<T>[];
  value: T;
  disabled?: boolean;
  onPick: (value: T) => void;
}) {
  return (
    <RadioGroup
      className="sn-chips"
      aria-label={label}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        onPick(next);
      }}
    >
      {options.map((option) => (
        <Radio.Root key={option.id} value={option.id} className="sn-chip">
          {option.label}
        </Radio.Root>
      ))}
    </RadioGroup>
  );
}

/** A 0–100 dial with the setting said in words beside it. */
export function Dial({
  label,
  word,
  value,
  low,
  high,
  disabled,
  onChange,
}: {
  label: string;
  word: string;
  value: number;
  low: string;
  high: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="sn-dial">
      <div className="sn-dial-head">
        <span className="sn-label">{label}</span>
        <span className="sn-value">{word}</span>
      </div>
      <Slider.Root
        value={value}
        min={0}
        max={100}
        disabled={disabled}
        onValueChange={(next) => {
          onChange(next);
        }}
      >
        <Slider.Control className="sn-slider">
          <Slider.Track className="sn-slider-track">
            <Slider.Indicator className="sn-slider-fill" />
            <Slider.Thumb className="sn-slider-thumb" aria-label={label} />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
      <div className="sn-dial-ends" aria-hidden="true">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

/** Content that opens in place. Closed content is inert, so it cannot catch focus or clicks. */
export function Expander({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div className="sn-exp" data-open={open || undefined}>
      <div inert={!open}>{children}</div>
    </div>
  );
}

/** A read-only link with a Copy button whose icon swaps to a check for two seconds. */
export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );
  return (
    <div className="sn-copy">
      <input
        value={value}
        readOnly
        aria-label={label}
        onFocus={(event) => {
          event.target.select();
        }}
      />
      <button
        type="button"
        className="sn-btn"
        aria-label={`Copy ${label.toLowerCase()}`}
        onClick={() => {
          navigator.clipboard.writeText(value).then(
            () => {
              setCopied(true);
              setFailed(false);
              clearTimeout(timer.current);
              timer.current = setTimeout(() => {
                setCopied(false);
              }, 2000);
            },
            () => {
              setFailed(true);
            },
          );
        }}
      >
        <span className="sn-swap" data-done={copied || undefined} aria-hidden="true">
          <Copy size={16} />
          <Check size={16} />
        </span>
        {copied ? 'Copied' : 'Copy'}
      </button>
      {failed ? <p className="sn-hint">Copying was blocked: select the link and copy it.</p> : null}
    </div>
  );
}
