import { Extension } from '@tiptap/core';
import { Image } from '@tiptap/extension-image';
import { Mention, type MentionOptions } from '@tiptap/extension-mention';
import { TableKit } from '@tiptap/extension-table';
import {
  ReactNodeViewRenderer,
  ReactRenderer,
  type AnyExtension,
  type Editor,
  type Range,
} from '@tiptap/react';
import Suggestion from '@tiptap/suggestion';
import type { ComponentType } from 'react';
import { MentionList, type MentionListHandle } from '@/features/tasks/components/mention-list';
import type { MentionSearch } from '@/features/tasks/components/rich-text-editor';
import { SlashMenu, type SlashMenuHandle, type SlashOption } from './slash-menu';
import { TaskMentionChip } from './task-mention-chip';

/** Pede uma imagem ao usuário; null quando ele desiste. */
export type ImagePicker = () => Promise<string | null>;

interface MenuContext<T> {
  editor: Editor;
  items: T[];
  command: (item: T) => void;
  mount: (element: HTMLElement) => () => void;
  loading?: boolean;
}

type MenuHandle = MentionListHandle | SlashMenuHandle;

/**
 * Monta o menu de um plugin de sugestão com um componente React. O plugin cuida
 * da posição (`mount`) e o componente cuida do próprio teclado.
 */
function menuRender<T>(
  component: ComponentType,
  toProps: (context: MenuContext<T>) => Record<string, unknown>,
) {
  return () => {
    let renderer: ReactRenderer<MenuHandle, Record<string, unknown>> | null = null;
    let unmount: (() => void) | undefined;

    return {
      onStart: (context: MenuContext<T>) => {
        renderer = new ReactRenderer(component, {
          editor: context.editor,
          props: toProps(context),
        });
        unmount = context.mount(renderer.element as HTMLElement);
      },
      onUpdate: (context: MenuContext<T>) => {
        renderer?.updateProps(toProps(context));
      },
      onKeyDown: (context: { event: KeyboardEvent }) => {
        if (context.event.key === 'Escape') {
          return false;
        }

        return renderer?.ref?.onKeyDown(context.event) ?? false;
      },
      onExit: () => {
        unmount?.();
        renderer?.destroy();
        renderer = null;
      },
    };
  };
}

interface MentionItem {
  id: string;
  label: string;
  hint?: string;
}

function mentionSuggestion(char: string, search: MentionSearch): Record<string, unknown> {
  return {
    char,
    items: ({ query }: { query: string }) => search(query),
    render: menuRender<MentionItem>(MentionList as unknown as ComponentType, (context) => ({
      items: context.items,
      loading: context.loading ?? false,
      command: context.command,
    })),
  };
}

/** Menção de pessoa: chip simples, igual ao da descrição da tarefa. */
export function personMention(search: MentionSearch): AnyExtension {
  return Mention.configure({
    HTMLAttributes: { class: 'mention' },
    suggestions: [mentionSuggestion('@', search)],
  }) as AnyExtension;
}

/** O chip da tarefa precisa saber o workspace para consultar o detalhe. */
interface TaskMentionOptions extends MentionOptions {
  wsId: string;
}

/** Menção de tarefa: nó próprio, desenhado pelo chip com o status ao vivo. */
export function taskMention(wsId: string, search: MentionSearch): AnyExtension {
  const TaskMention = Mention.extend<TaskMentionOptions>({
    name: 'taskMention',
    addOptions() {
      return { ...this.parent?.(), wsId: '' } as TaskMentionOptions;
    },
    addNodeView() {
      return ReactNodeViewRenderer(TaskMentionChip);
    },
  });

  return TaskMention.configure({
    wsId,
    HTMLAttributes: { class: 'mention mention-task' },
    suggestions: [mentionSuggestion('#', search)],
  }) as AnyExtension;
}

interface SlashItem extends SlashOption {
  run: (editor: Editor, range: Range) => void;
}

const SLASH_ITEMS: SlashItem[] = [
  {
    id: 'h1',
    label: 'Título 1',
    hint: 'H1',
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
    },
  },
  {
    id: 'h2',
    label: 'Título 2',
    hint: 'H2',
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
    },
  },
  {
    id: 'h3',
    label: 'Título 3',
    hint: 'H3',
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run();
    },
  },
  {
    id: 'bullet',
    label: 'Lista',
    hint: 'marcadores',
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    id: 'ordered',
    label: 'Lista numerada',
    hint: '1.',
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    id: 'todo',
    label: 'Checklist',
    hint: 'tarefas',
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    id: 'table',
    label: 'Tabela',
    hint: '3 x 3',
    run: (editor, range) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run();
    },
  },
  {
    id: 'code',
    label: 'Código',
    hint: 'bloco',
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    id: 'quote',
    label: 'Citação',
    hint: 'bloco',
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    id: 'divider',
    label: 'Divisor',
    hint: 'linha',
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    id: 'image',
    label: 'Imagem',
    hint: 'arquivo',
    run: () => {
      // tratada no `command`, porque depende de um arquivo do usuário
    },
  },
];

/**
 * Menu `/comandos`: títulos, listas, checklist, tabela, código, citação, divisor
 * e imagem (que abre o seletor de arquivo).
 */
export function slashCommands(pickImage: ImagePicker): AnyExtension {
  return Extension.create({
    name: 'slashCommands',
    addProseMirrorPlugins() {
      return [
        Suggestion<SlashItem>({
          editor: this.editor,
          char: '/',
          items: ({ query }) => {
            const text = query.trim().toLowerCase();

            return SLASH_ITEMS.filter(
              (item) => text === '' || item.label.toLowerCase().includes(text),
            );
          },
          command: ({ editor, range, props }) => {
            if (props.id !== 'image') {
              props.run(editor, range);

              return;
            }

            editor.chain().focus().deleteRange(range).run();

            void pickImage().then((src) => {
              if (src !== null) {
                editor.chain().focus().setImage({ src }).run();
              }
            });
          },
          render: menuRender<SlashItem>(SlashMenu as unknown as ComponentType, (context) => ({
            items: context.items,
            command: context.command,
          })),
        }),
      ];
    },
  }) as AnyExtension;
}

/** Tabela e imagem: os blocos do Doc que o starter-kit não traz. */
export function docBlocks(): AnyExtension[] {
  return [
    TableKit.configure({ table: { resizable: false } }) as AnyExtension,
    Image.configure({ HTMLAttributes: { class: 'doc-image' } }) as AnyExtension,
  ];
}
