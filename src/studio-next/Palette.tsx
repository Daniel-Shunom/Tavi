import { useEffect, useId, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { Search } from 'lucide-react';
import { filterCommands } from './model';
import { useLayer } from './ui';

// "Jump to anything": every place and action in Studio, one search away (Ctrl K). The highlight
// follows the arrow keys with no transition, so it never lags behind the keyboard.

export type PaletteCommand = {
  id: string;
  label: string;
  kind: 'Place' | 'Action' | 'Reaction' | 'Theme';
  keywords?: string;
  disabled?: boolean;
  run: () => void;
};

export function Palette({
  open,
  onOpenChange,
  commands,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: readonly PaletteCommand[];
}) {
  const layer = useLayer();
  const listId = useId();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const found = filterCommands(commands, query).filter((command) => !command.disabled);
  const current = found[Math.min(active, found.length - 1)];
  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);
  const run = (command: PaletteCommand) => {
    onOpenChange(false);
    command.run();
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={layer}>
        <Dialog.Backdrop className="sn-backdrop" />
        <Dialog.Popup className="sn-palette" aria-label="Jump to anything">
          <label className="sn-palette-search">
            <Search size={18} aria-hidden="true" />
            <input
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={current ? `${listId}-${current.id}` : undefined}
              aria-label="Search places and actions"
              placeholder="Type a place or an action"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault();
                  if (!found.length) return;
                  const step = event.key === 'ArrowDown' ? 1 : -1;
                  const next =
                    (Math.min(active, found.length - 1) + step + found.length) % found.length;
                  setActive(next);
                  const id = found[next]?.id;
                  if (id)
                    document
                      .getElementById(`${listId}-${id}`)
                      ?.scrollIntoView({ block: 'nearest' });
                } else if (event.key === 'Enter' && current) {
                  event.preventDefault();
                  run(current);
                }
              }}
            />
          </label>
          <div className="sn-palette-list" id={listId} role="listbox" aria-label="Results">
            {found.map((command) => (
              <div
                key={command.id}
                id={`${listId}-${command.id}`}
                role="option"
                aria-selected={command === current}
                className="sn-palette-item"
                onPointerMove={() => {
                  const index = found.indexOf(command);
                  if (index !== active) setActive(index);
                }}
                onClick={() => {
                  run(command);
                }}
              >
                {command.label}
                <span>{command.kind}</span>
              </div>
            ))}
            {found.length ? null : (
              <p className="sn-palette-empty">Nothing matches “{query}”. Try “look” or “quiet”.</p>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
