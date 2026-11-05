import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Mention } from '@tiptap/extension-mention';
import { Placeholder } from '@tiptap/extension-placeholder';
import { EditorContent, ReactRenderer, useEditor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { SuggestionOptions } from '@tiptap/suggestion';
import {
  Bold,
  Code,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  ListTodo,
  Strikethrough,
} from 'lucide-react';
import { useEffect, useRef, type ComponentType } from 'react';
import { cn } from '@/lib/utils';
import { MentionList, type MentionListHandle, type MentionOption } from './mention-list';

export type { MentionOption };

/** Busca das opções do @ e do #; o painel liga cada uma à sua fonte. */
export type MentionSearch = (query: string) => Promise<MentionOption[]>;

/** Atributos que o nó de menção guarda; é o que o `command` do Mention insere. */
interface MentionAttrs {
  id: string | null;
  label?: string | null;
}

type Suggestion = Omit<SuggestionOptions<MentionOption, MentionAttrs>, 'editor'>;

/**
 * Menu de sugestão do Tiptap: o plugin monta o elemento e cuida da posição
 * (`props.mount`), então aqui só entra a lista e o teclado.
 */
function suggestionFor(char: string, search: MentionSearch): Suggestion {
  return {
    char,
    items: ({ query }) => search(query),
    render: () => {
      let renderer: ReactRenderer<MentionListHandle, Record<string, unknown>> | null = null;
      let unmount: (() => void) | undefined;

      return {
        onStart: (props) => {
          renderer = new ReactRenderer(MentionList as unknown as ComponentType, {
            editor: props.editor,
            props: { items: props.items, loading: props.loading, command: props.command },
          });
          unmount = props.mount(renderer.element);
        },
        onUpdate: (props) => {
          renderer?.updateProps({
            items: props.items,
            loading: props.loading,
            command: props.command,
          });
        },
        onKeyDown: (props) => {
          if (props.event.key === 'Escape') {
            return false;
          }

          return renderer?.ref?.onKeyDown(props.event) ?? false;
        },
        onExit: () => {
          unmount?.();
          renderer?.destroy();
          renderer = null;
        },
      };
    },
  };
}

export interface RichTextEditorProps {
  /** Documento do Tiptap; null quando a descrição está vazia. */
  value: JSONContent | null;
  editable: boolean;
  placeholder: string;
  searchPeople: MentionSearch;
  searchTasks: MentionSearch;
  onChange: (doc: JSONContent, text: string) => void;
  'aria-label': string;
  className?: string;
}

const toolbarButton =
  'flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink aria-pressed:bg-surface-2 aria-pressed:text-accent';

/**
 * Editor da descrição: títulos, listas, checklist, código, link, @pessoa e
 * #tarefa. Ele avisa cada mudança; quem salva (com debounce) é o chamador.
 */
export function RichTextEditor({
  value,
  editable,
  placeholder,
  searchPeople,
  searchTasks,
  onChange,
  'aria-label': ariaLabel,
  className,
}: RichTextEditorProps) {
  const notify = useRef(onChange);
  const people = useRef(searchPeople);
  const tasks = useRef(searchTasks);

  notify.current = onChange;
  people.current = searchPeople;
  tasks.current = searchTasks;

  const editor = useEditor({
    editable,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: 'noreferrer nofollow' },
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
      Mention.configure({
        HTMLAttributes: { class: 'mention' },
        suggestions: [
          suggestionFor('@', (query) => people.current(query)),
          suggestionFor('#', (query) => tasks.current(query)),
        ],
      }),
    ],
    content: value ?? '',
    editorProps: {
      attributes: {
        class: cn('rich-text min-h-[88px] w-full', className),
        'aria-label': ariaLabel,
        role: 'textbox',
        'aria-multiline': 'true',
      },
    },
    onUpdate: ({ editor: instance }) => {
      notify.current(instance.getJSON(), instance.getText());
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  if (!editor) {
    return <div className="min-h-[88px] rounded-xl border border-line bg-surface" />;
  }

  const marks: {
    label: string;
    icon: typeof Bold;
    active: () => boolean;
    run: () => void;
  }[] = [
    {
      label: 'Negrito',
      icon: Bold,
      active: () => editor.isActive('bold'),
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: 'Itálico',
      icon: Italic,
      active: () => editor.isActive('italic'),
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: 'Riscado',
      icon: Strikethrough,
      active: () => editor.isActive('strike'),
      run: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      label: 'Título',
      icon: Heading2,
      active: () => editor.isActive('heading', { level: 2 }),
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: 'Lista',
      icon: List,
      active: () => editor.isActive('bulletList'),
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: 'Lista numerada',
      icon: ListOrdered,
      active: () => editor.isActive('orderedList'),
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: 'Checklist',
      icon: ListTodo,
      active: () => editor.isActive('taskList'),
      run: () => editor.chain().focus().toggleTaskList().run(),
    },
    {
      label: 'Código',
      icon: Code,
      active: () => editor.isActive('codeBlock'),
      run: () => editor.chain().focus().toggleCodeBlock().run(),
    },
    {
      label: 'Link',
      icon: Link2,
      active: () => editor.isActive('link'),
      run: () => {
        if (editor.isActive('link')) {
          editor.chain().focus().unsetLink().run();

          return;
        }

        const href = window.prompt('Endereço do link');

        if (href !== null && href.trim() !== '') {
          editor.chain().focus().setLink({ href: href.trim() }).run();
        }
      },
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      {editable ? (
        <div role="toolbar" aria-label="Formatação da descrição" className="flex flex-wrap gap-0.5">
          {marks.map((mark) => {
            const Icon = mark.icon;

            return (
              <button
                key={mark.label}
                type="button"
                aria-label={mark.label}
                aria-pressed={mark.active()}
                className={toolbarButton}
                onClick={mark.run}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      ) : null}

      <EditorContent editor={editor} />
    </div>
  );
}
