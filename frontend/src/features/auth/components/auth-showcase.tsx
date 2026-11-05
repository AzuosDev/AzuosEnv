import { CalendarClock, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface Slide {
  title: string;
  description: string;
}

/** Apresentação do produto: tarefas, projetos e equipe da Azuos. */
const SLIDES: Slide[] = [
  {
    title: 'O trabalho da equipe em um lugar',
    description:
      'Spaces, folders e listas organizam cada projeto da Azuos, da ideia até a entrega.',
  },
  {
    title: 'Cada pessoa vê do jeito que precisa',
    description:
      'A mesma lista vira quadro, com os filtros, o agrupamento e a ordenação guardados na view.',
  },
  {
    title: 'Todo mundo no mesmo ritmo',
    description:
      'Responsáveis, prazos e status mudam para a equipe inteira no instante em que alguém move a tarefa.',
  },
];

const ROTATION_MS = 7000;

/** Tarefas de exemplo do cartão central (ilustração, sem dados reais). */
const SAMPLE_TASKS = [
  { name: 'Revisar a API de tarefas', status: 'Em andamento' },
  { name: 'Ajustar o layout do quadro', status: 'Concluída' },
  { name: 'Publicar a versão', status: 'A fazer' },
];

/** Iniciais dos responsáveis do cartão de equipe (ilustração). */
const SAMPLE_PEOPLE = ['FS', 'MC', 'AL'];

/** Painel direito das telas de acesso: ilustração + carrossel de recursos. */
export function AuthShowcase() {
  const [index, setIndex] = useState(0);
  const [floating, setFloating] = useState(false);

  useEffect(() => {
    const frame = window.setTimeout(() => {
      setFloating(true);
    }, 80);

    return () => {
      window.clearTimeout(frame);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % SLIDES.length);
    }, ROTATION_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const slide = SLIDES[index] ?? SLIDES[0];

  if (!slide) {
    return null;
  }

  return (
    <div className="hidden lg:sticky lg:top-0 lg:block lg:h-dvh lg:p-3">
      <section
        aria-roledescription="carrossel"
        aria-label="Recursos do Azuos Env"
        className="stage relative flex h-full flex-col overflow-hidden rounded-[28px] border border-scene-line px-10 pb-10 pt-8 xl:px-14"
      >
        <div
          aria-hidden="true"
          className="dot-grid pointer-events-none absolute inset-0 opacity-70"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 -top-48 h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle_at_35%_65%,rgb(var(--signal)/0.18),rgb(var(--signal-2)/0.06)_55%,transparent_72%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(to_top,rgb(var(--paper)/0.55),transparent)]"
        />

        <div className="relative flex flex-1 items-center justify-center py-8">
          <div
            aria-hidden="true"
            className="relative aspect-[10/9] w-full max-w-[440px] select-none"
          >
            <div
              className={cn(
                'btn-signal absolute -top-[3%] right-0 z-10 aspect-[1.586] w-[52%] rotate-[-14deg] rounded-[14px] p-4 transition-[transform,box-shadow] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]',
                floating && '-translate-y-2',
              )}
            >
              <div className="flex items-start justify-between">
                <span className="text-sm font-bold tracking-tight">&lt;/&gt; Azuos Env</span>
                <span className="h-5 w-7 rounded-[5px] bg-on-signal/20" />
              </div>
              <p className="absolute bottom-4 left-4 text-[0.8125rem] font-semibold tracking-[0.18em]">
                AZUOS DEV
              </p>
              <p className="absolute bottom-4 right-4 text-[0.625rem] font-semibold uppercase tracking-wider opacity-70">
                Workspace
              </p>
            </div>

            <div
              className={cn(
                'absolute left-[4%] top-[20%] w-[64%] rounded-[18px] border border-line bg-surface p-5 shadow-[0_24px_48px_-16px_rgb(var(--paper)/0.85)] transition-[transform,box-shadow] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]',
                floating && '-translate-y-1.5',
              )}
            >
              <p className="text-xs font-medium text-muted">Lista da semana</p>
              <p className="heading mt-1 text-[1.375rem]">Sprint do app</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div className="btn-signal h-full w-[62%] rounded-full" />
              </div>
              <p className="mt-1.5 text-[0.6875rem] text-muted">Progresso da lista</p>
              <ul className="mt-4 space-y-2 border-t border-line pt-3 text-xs">
                {SAMPLE_TASKS.map((task) => (
                  <li key={task.name} className="flex items-center justify-between gap-3">
                    <span className="truncate text-body">{task.name}</span>
                    <span className="shrink-0 font-semibold text-accent">{task.status}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div
              className={cn(
                'absolute bottom-[3%] right-[3%] z-20 w-[44%] rounded-[16px] border border-line bg-surface p-4 shadow-[0_18px_36px_-12px_rgb(var(--paper)/0.8)] transition-[transform,box-shadow] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]',
                floating && '-translate-y-1',
              )}
            >
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-[9px] bg-accent/15 text-accent">
                  <Users className="h-3.5 w-3.5" />
                </span>
                <span className="text-xs font-semibold text-ink">Equipe</span>
                <span className="ml-auto flex -space-x-1.5">
                  {SAMPLE_PEOPLE.map((initials) => (
                    <span
                      key={initials}
                      className="grid h-5 w-5 place-items-center rounded-full border border-surface bg-surface-2 text-[0.5rem] font-semibold text-body"
                    >
                      {initials}
                    </span>
                  ))}
                </span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full w-[55%] rounded-full bg-accent" />
              </div>
              <p className="mt-1.5 text-[0.6875rem] text-muted">Tarefas por pessoa</p>
            </div>

            <div
              className={cn(
                'absolute bottom-[10%] left-0 z-20 flex items-center gap-2.5 rounded-full bg-scene py-2 pl-2 pr-4 ring-1 ring-scene-line shadow-[0_16px_32px_-12px_rgb(var(--paper)/0.8)] transition-[transform,box-shadow] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]',
                floating && '-translate-y-1',
              )}
            >
              <span className="btn-signal grid h-8 w-8 place-items-center rounded-full">
                <CalendarClock className="h-4 w-4" />
              </span>
              <span className="text-xs leading-tight">
                <span className="block font-semibold text-ink">Entrega</span>
                <span className="text-muted">vence amanhã</span>
              </span>
            </div>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md text-center">
          <div key={index} className="auth-rise">
            <h2 className="heading text-balance text-[1.75rem] leading-tight">{slide.title}</h2>
            <p className="mx-auto mt-3 max-w-[42ch] text-pretty text-[0.9375rem] leading-relaxed text-body">
              {slide.description}
            </p>
          </div>
          <div className="mt-8 flex items-center justify-center gap-1">
            {SLIDES.map((item, position) => (
              <button
                key={item.title}
                type="button"
                aria-label={`Mostrar recurso ${String(position + 1)} de ${String(SLIDES.length)}: ${item.title}`}
                aria-current={position === index}
                onClick={() => {
                  setIndex(position);
                }}
                className="group grid h-6 place-items-center px-1"
              >
                <span
                  className={cn(
                    'block h-1.5 rounded-full transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
                    position === index
                      ? 'w-6 bg-signal'
                      : 'w-1.5 bg-muted/40 group-hover:bg-muted/70',
                  )}
                />
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
