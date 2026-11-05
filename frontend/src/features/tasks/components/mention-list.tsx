import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

/** Uma opção do menu de @pessoa ou #tarefa. */
export interface MentionOption {
  id: string;
  label: string;
  /** Texto menor à direita: e-mail da pessoa ou customId da tarefa. */
  hint?: string;
}

export interface MentionListProps {
  items: MentionOption[];
  loading: boolean;
  command: (option: { id: string; label: string }) => void;
}

/** O que o plugin de sugestão chama no teclado. */
export interface MentionListHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

/**
 * Menu do @ e do #. Fica fora do React da página (o plugin monta o elemento),
 * então ele cuida do próprio teclado e não usa Radix.
 */
export const MentionList = forwardRef<MentionListHandle, MentionListProps>(function MentionList(
  { items, loading, command },
  ref,
) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [items]);

  const pick = (position: number): void => {
    const option = items[position];

    if (option) {
      command({ id: option.id, label: option.label });
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
      aria-label="Sugestões da menção"
      className="z-50 max-h-64 w-64 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-xl"
    >
      {loading ? <p className="px-2 py-2 text-[12.5px] text-muted">Buscando…</p> : null}

      {!loading && items.length === 0 ? (
        <p className="px-2 py-2 text-[12.5px] text-muted">Nada encontrado.</p>
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
          {option.hint ? (
            <span className="shrink-0 text-[11.5px] text-muted">{option.hint}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
});
