import Markdown from 'react-markdown';
import { cn } from '@/lib/utils';

/**
 * Resposta da IA em markdown. Sem HTML cru e sem plugins: só o que o
 * react-markdown entende de CommonMark, com os estilos do app.
 */
export function AiMarkdown({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn('rich-text text-[14px] leading-6', className)}>
      <Markdown
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer nofollow">
              {children}
            </a>
          ),
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}
