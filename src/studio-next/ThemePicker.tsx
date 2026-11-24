import { Select } from '@base-ui/react/select';
import { Check, ChevronDown } from 'lucide-react';
import type { HolidayId } from './holiday/calendar';
import {
  activeScheme,
  chooseScheme,
  offeredSchemes,
  schemeGroups,
  toneChoices,
  type Palette,
  type ThemeChoice,
} from './themes';
import { Segmented, useLayer } from './ui';

// Choosing Studio's theme: one dropdown for the colour scheme, and light or dark (or whatever
// the computer is set to). Deliberately nothing more. A holiday theme appears in the list only
// during its season, already selected.

/** A tiny picture of a scheme: its canvas with its two colours. */
function Sample({ palette }: { palette: Palette }) {
  return (
    <span
      className="sn-theme-sample"
      aria-hidden="true"
      style={{ background: palette.bg, borderColor: palette.line }}
    >
      <i style={{ background: palette.accent }} />
      <i style={{ background: palette.second }} />
    </span>
  );
}

export function ThemePicker({
  theme,
  tone,
  onTheme,
  season,
}: {
  theme: ThemeChoice;
  /** The tone showing now, so the samples match what the streamer will get. */
  tone: 'dark' | 'light';
  onTheme: (theme: ThemeChoice) => void;
  /** The holiday in season, if any: its theme is the only holiday on offer. */
  season: HolidayId | null;
}) {
  const layer = useLayer();
  const current = activeScheme(theme, season);
  const offered = offeredSchemes(season);

  return (
    <div className="sn-theme">
      <div className="sn-group">
        <span className="sn-label" id="theme-scheme">
          Colours
        </span>
        <Select.Root
          value={current.id}
          onValueChange={(scheme) => {
            if (scheme) onTheme(chooseScheme(theme, scheme, season));
          }}
        >
          <Select.Trigger className="sn-select" aria-labelledby="theme-scheme">
            <Sample palette={current[tone]} />
            <span className="sn-select-value">{current.label}</span>
            <Select.Icon className="sn-select-icon">
              <ChevronDown size={18} />
            </Select.Icon>
          </Select.Trigger>
          <Select.Portal container={layer}>
            <Select.Positioner
              className="sn-select-layer"
              sideOffset={6}
              alignItemWithTrigger={false}
            >
              <Select.Popup className="sn-select-popup">
                <Select.List>
                  {schemeGroups.map((group) => {
                    const items = offered.filter((scheme) => scheme.group === group.id);
                    if (!items.length) return null;
                    return (
                      <Select.Group key={group.id} className="sn-select-group">
                        <Select.GroupLabel className="sn-select-heading">
                          {group.id === 'holiday' ? 'In season' : group.label}
                        </Select.GroupLabel>
                        {items.map((scheme) => (
                          <Select.Item key={scheme.id} value={scheme.id} className="sn-select-item">
                            <Sample palette={scheme[tone]} />
                            <span className="sn-select-text">
                              <Select.ItemText>{scheme.label}</Select.ItemText>
                              <span>{scheme.note}</span>
                            </span>
                            <Select.ItemIndicator className="sn-select-check">
                              <Check size={16} />
                            </Select.ItemIndicator>
                          </Select.Item>
                        ))}
                      </Select.Group>
                    );
                  })}
                </Select.List>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      </div>

      <div className="sn-group">
        <span className="sn-label">Appearance</span>
        <Segmented
          label="Appearance"
          options={toneChoices}
          value={theme.tone}
          onPick={(next) => {
            onTheme({ ...theme, tone: next });
          }}
        />
      </div>
    </div>
  );
}
