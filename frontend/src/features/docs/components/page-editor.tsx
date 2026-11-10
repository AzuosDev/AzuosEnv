import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extension-placeholder';
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Quote,
  Strikethrough,
  Table as TableIcon,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import type { MentionSearch } from '@/features/tasks/components/rich-text-editor';
import { docBlocks, personMention, slashCommands, taskMention } from './doc-extensions';

/** Tamanho máximo da imagem embutida na página, em bytes. */
export const MAX_IMAGE_BYTES = 1_000_000;

export interface PageEditorProps {
  wsId: string;
  value: JSONContent | null;
  editable: boolean;
  searchPeople: MentionSearch;
  searchTasks: MentionSearch;
  onChange: (doc: JSONContent, text: string) => void;
  /** Trecho selecionado, para ancorar um comentário novo. */
  onSelect?: (excerpt: string) => void;
  /** Lê a imagem escolhida; recusar devolve null. */
  pickImage: () => Promise<string | null>;
}

const toolbarButton =
  'flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink aria-pressed:bg-surface-2 aria-pressed:text-accent md:h-9 md:w-9';

/**
 * Editor da página do Doc: barra completa, menu `/comandos`, menção de pessoa e
 * chip de tarefa. Quem salva (com debounce e version) é o chamador.
 */
export function PageEditor({
  wsId,
  value,
  editable,
  searchPeople,
  searchTasks,
  onChange,
  onSelect,
  pickImage,
}: PageEditorProps) {
  const notify = useRef(onChange);
  const select = useRef(onSelect);
  const people = useRef(searchPeople);
  const tasks = useRef(searchTasks);
  const image = useRef(pickImage);

  notify.current = onChange;
  select.current = onSelect;
  people.current = searchPeople;
  tasks.current = searchTasks;
  image.current = pickImage;

  const extensions = useMemo(
    () => [
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
      Placeholder.configure({ placeholder: 'Digite / para inserir blocos…' }),
      ...docBlocks(),
      personMention((query) => people.current(query)),
      taskMention(wsId, (query) => tasks.current(query)),
      slashCommands(() => image.current()),
    ],
    [wsId],
  );

  const editor = useEditor(
    {
      editable,
      extensions,
      content: value ?? '',
      editorProps: {
        attributes: {
          class: 'rich-text doc-page min-h-[280px] w-full',
          'aria-label': 'Conteúdo da página',
          role: 'textbox',
          'aria-multiline': 'true',
        },
      },
      onUpdate: ({ editor: instance }) => {
        notify.current(instance.getJSON(), instance.getText());
      },
      onSelectionUpdate: ({ editor: instance }) => {
        const { from, to } = instance.state.selection;
        const excerpt = from === to ? '' : instance.state.doc.textBetween(from, to, ' ').trim();

        select.current?.(excerpt.slice(0, 200));
      },
      immediatelyRender: false,
    },
    [extensions],
  );

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  if (!editor) {
    return <div className="min-h-[280px] rounded-xl border border-line bg-surface" />;
  }

  const marks: { label: string; icon: LucideIcon; active: () => boolean; run: () => void }[] = [
    {
      label: 'Negrito',
      icon: Bold,
      active: () => editor.isActive('bold'),
      run: () => {
        editor.chain().focus().toggleBold().run();
      },
    },
    {
      label: 'Itálico',
      icon: Italic,
      active: () => editor.isActive('italic'),
      run: () => {
        editor.chain().focus().toggleItalic().run();
      },
    },
    {
      label: 'Riscado',
      icon: Strikethrough,
      active: () => editor.isActive('strike'),
      run: () => {
        editor.chain().focus().toggleStrike().run();
      },
    },
    {
      label: 'Título 1',
      icon: Heading1,
      active: () => editor.isActive('heading', { level: 1 }),
      run: () => {
        editor.chain().focus().toggleHeading({ level: 1 }).run();
      },
    },
    {
      label: 'Título 2',
      icon: Heading2,
      active: () => editor.isActive('heading', { level: 2 }),
      run: () => {
        editor.chain().focus().toggleHeading({ level: 2 }).run();
      },
    },
    {
      label: 'Lista',
      icon: List,
      active: () => editor.isActive('bulletList'),
      run: () => {
        editor.chain().focus().toggleBulletList().run();
      },
    },
    {
      label: 'Lista numerada',
      icon: ListOrdered,
      active: () => editor.isActive('orderedList'),
      run: () => {
        editor.chain().focus().toggleOrderedList().run();
      },
    },
    {
      label: 'Checklist',
      icon: ListTodo,
      active: () => editor.isActive('taskList'),
      run: () => {
        editor.chain().focus().toggleTaskList().run();
      },
    },
    {
      label: 'Tabela',
      icon: TableIcon,
      active: () => editor.isActive('table'),
      run: () => {
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      },
    },
    {
      label: 'Código',
      icon: Code,
      active: () => editor.isActive('codeBlock'),
      run: () => {
        editor.chain().focus().toggleCodeBlock().run();
      },
    },
    {
      label: 'Citação',
      icon: Quote,
      active: () => editor.isActive('blockquote'),
      run: () => {
        editor.chain().focus().toggleBlockquote().run();
      },
    },
    {
      label: 'Divisor',
      icon: Minus,
      active: () => false,
      run: () => {
        editor.chain().focus().setHorizontalRule().run();
      },
    },
    {
      label: 'Imagem',
      icon: ImageIcon,
      active: () => editor.isActive('image'),
      run: () => {
        void image.current().then((src) => {
          if (src !== null) {
            editor.chain().focus().setImage({ src }).run();
          }
        });
      },
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
    <div className="flex flex-col gap-3">
      {editable ? (
        <div
          role="toolbar"
          aria-label="Formatação: Conteúdo da página"
          className="sticky bottom-0 z-20 -mx-1 order-last flex flex-wrap gap-0.5 border-t border-line bg-paper px-1 py-1 md:static md:order-first md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0"
        >
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
