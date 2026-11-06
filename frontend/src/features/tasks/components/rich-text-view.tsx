import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Nó do documento do Tiptap, no subconjunto que o editor do app produz. */
interface Node {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type?: string; attrs?: Record<string, unknown> }[];
  content?: Node[];
}

export interface RichTextViewProps {
  /** Documento gravado pelo editor; null cai no texto puro. */
  value: unknown;
  /** Texto puro da mesma mensagem, usado quando não há documento. */
  text?: string;
  className?: string;
}

function attr(node: Node, name: string): string {
  const value = node.attrs?.[name];

  return typeof value === 'string' ? value : '';
}

function withMarks(node: Node, key: string): ReactNode {
  let content: ReactNode = node.text ?? '';

  for (const mark of node.marks ?? []) {
    if (mark.type === 'bold') {
      content = <strong>{content}</strong>;
    } else if (mark.type === 'italic') {
      content = <em>{content}</em>;
    } else if (mark.type === 'strike') {
      content = <s>{content}</s>;
    } else if (mark.type === 'code') {
      content = <code>{content}</code>;
    } else if (mark.type === 'link') {
      const href = typeof mark.attrs?.href === 'string' ? mark.attrs.href : '';

      content = (
        <a href={href} target="_blank" rel="noreferrer nofollow">
          {content}
        </a>
      );
    }
  }

  return <span key={key}>{content}</span>;
}

function children(node: Node, key: string): ReactNode[] {
  return (node.content ?? []).map((child, index) => render(child, `${key}.${String(index)}`));
}

function render(node: Node, key: string): ReactNode {
  if (node.type === 'text') {
    return withMarks(node, key);
  }

  if (node.type === 'hardBreak') {
    return <br key={key} />;
  }

  if (node.type === 'mention') {
    const label = attr(node, 'label') || attr(node, 'id');
    const char = attr(node, 'mentionSuggestionChar') || '@';

    return (
      <span key={key} className="mention">
        {char}
        {label}
      </span>
    );
  }

  if (node.type === 'heading') {
    const level = Number(node.attrs?.level ?? 2);
    const Tag = level <= 1 ? 'h3' : level === 2 ? 'h4' : 'h5';

    return <Tag key={key}>{children(node, key)}</Tag>;
  }

  if (node.type === 'bulletList') {
    return <ul key={key}>{children(node, key)}</ul>;
  }

  if (node.type === 'orderedList') {
    return <ol key={key}>{children(node, key)}</ol>;
  }

  if (node.type === 'listItem') {
    return <li key={key}>{children(node, key)}</li>;
  }

  if (node.type === 'taskList') {
    return (
      <ul key={key} data-type="taskList">
        {children(node, key)}
      </ul>
    );
  }

  if (node.type === 'taskItem') {
    return (
      <li key={key} data-checked={node.attrs?.checked === true}>
        <label>
          <input
            type="checkbox"
            checked={node.attrs?.checked === true}
            aria-label="Item da checklist"
            disabled
            readOnly
          />
        </label>
        <div>{children(node, key)}</div>
      </li>
    );
  }

  if (node.type === 'codeBlock') {
    return (
      <pre key={key}>
        <code>{children(node, key)}</code>
      </pre>
    );
  }

  if (node.type === 'blockquote') {
    return <blockquote key={key}>{children(node, key)}</blockquote>;
  }

  if (node.type === 'horizontalRule') {
    return <hr key={key} />;
  }

  if (node.type === 'paragraph') {
    return <p key={key}>{children(node, key)}</p>;
  }

  return <div key={key}>{children(node, key)}</div>;
}

/**
 * Texto rico só para leitura. Desenha o documento do Tiptap direto em React —
 * nada de instanciar um editor por comentário — com o mesmo estilo .rich-text.
 */
export function RichTextView({ value, text, className }: RichTextViewProps) {
  const doc = value as Node | null;

  if (!doc || doc.type !== 'doc' || (doc.content ?? []).length === 0) {
    return text && text.trim() !== '' ? (
      <div className={cn('rich-text whitespace-pre-wrap', className)}>{text}</div>
    ) : null;
  }

  return <div className={cn('rich-text', className)}>{children(doc, 'n')}</div>;
}
