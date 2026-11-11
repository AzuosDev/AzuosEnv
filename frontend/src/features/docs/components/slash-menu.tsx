import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

/** Um comando do menu `/`. */
export interface SlashOption {
  id: string;
  label: string;
  hint: string;
}

export interface SlashMenuProps {
  items: SlashOption[];
  command: (option: SlashOption) => void;
}

export interface SlashMenuHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

/**
 * Menu do `/`. Como o do @, ele vive fora do React da página (o plugin de
 * sugestão monta o elemento), então cuida do próprio teclado.
 */
export const SlashMenu = forwardRef<SlashMenuHandle, SlashMenuProps>(function SlashMenu(
  { items, command },
  ref,
) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [items]);

  const pick = (position: number): void => {
    const option = items[position];

    if (option) {
      command(option);
    }
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: (event) => {
      if (event.key === 'ArrowDown') {
        setIndex((current) => (items.length === 0 ? 0 : (current + 1) % items.length));

        return true;
      }

      if (event.key === 'ArrowUp') {
        setIndex((current) =>
          items.length === 0 ? 0 : (current - 1 + items.length) % items.length,
        );

        return true;
      }

      if (event.key === 'Enter' || event.key === 'Tab') {
        pick(index);

        return true;
      }

      return false;
    },
  }));

  return (
    <div
      role="listbox"
      aria-label="Comandos do editor"
      className="z-50 max-h-72 w-60 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-xl"
    >
      {items.length === 0 ? (
        <p className="px-2 py-2 text-[12.5px] text-muted">Nenhum comando.</p>
      ) : null}

      {items.map((option, position) => (
        <button
          key={option.id}
          type="button"
          role="option"
          aria-selected={position === index}
          className={`flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] ${
            position === index ? 'bg-surface-2 text-ink' : 'text-body'
          }`}
          onMouseEnter={() => {
            setIndex(position);
          }}
          onClick={() => {
            pick(position);
          }}
        >
          <span className="min-w-0 flex-1 truncate">{option.label}</span>
          <span className="shrink-0 text-[11.5px] text-muted">{option.hint}</span>
        </button>
      ))}
    </div>
  );
});
