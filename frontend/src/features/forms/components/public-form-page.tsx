import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { errorMessage } from '@/api/errors';
import type { SubmitFormResult } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { ThemeToggle } from '@/components/theme-toggle';
import { publicFormQuery, submitPublicForm } from '../api';
import { answersToSend, missingAnswers } from '../form-model';
import { FormFieldsView, type FormValues } from './form-fields-view';

/** Nome do honeypot, igual ao que o backend recusa quando vem preenchido. */
const HONEYPOT = 'website';

/**
 * Formulário público: abre sem sessão, com a cara do site da Azuos Dev. O campo
 * honeypot fica escondido do olho e do leitor de tela — robô preenche, pessoa não.
 */
export function PublicFormPage({ token }: { token: string }) {
  const form = useQuery(publicFormQuery(token));
  const [values, setValues] = useState<FormValues>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [honeypot, setHoneypot] = useState('');
  const [done, setDone] = useState<SubmitFormResult | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: () =>
      submitPublicForm(token, {
        values: answersToSend(form.data?.fields ?? [], form.data?.conditions ?? [], values),
        ...(honeypot === '' ? {} : { website: honeypot }),
      }),
    onSuccess: (result) => {
      setDone(result);
      setFailed(null);
    },
    onError: (error: unknown) => {
      setFailed(errorMessage(error));
    },
  });

  return (
    <div className="min-h-dvh bg-paper px-4 py-6 md:px-6 md:py-8">
      <header className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center gap-3">
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="btn-signal flex h-10 w-10 items-center justify-center rounded-xl text-[13px] font-bold"
          >
            {'</>'}
          </span>
          <span className="font-semibold text-ink">Azuos Dev</span>
        </span>
        <span className="ml-auto flex items-center gap-2">
          <ThemeToggle />
        </span>
      </header>

      <main className="mx-auto mt-6 w-full max-w-[680px]">
        {form.isPending ? (
          <Spinner label="Carregando o formulário" />
        ) : form.isError || !form.data ? (
          <section className="stage relative overflow-hidden rounded-3xl border border-scene-line p-8">
            <div
              className="dot-grid pointer-events-none absolute inset-0 opacity-60"
              aria-hidden="true"
            />
            <div className="relative flex flex-col gap-3">
              <h1 className="heading text-2xl">Formulário fora do ar</h1>
              <p className="text-[14px] text-body">
                Este link não existe mais ou o formulário foi desativado.
              </p>
            </div>
          </section>
        ) : (
          <section
            aria-label={form.data.title}
            className="stage relative overflow-hidden rounded-3xl border border-scene-line"
          >
            <div
              className="dot-grid pointer-events-none absolute inset-0 opacity-60"
              aria-hidden="true"
            />

            <div className="relative flex flex-col gap-5 p-6 md:p-10">
              {done ? (
                <div role="status" className="flex flex-col gap-4">
                  <h1 className="heading text-2xl md:text-4xl">Recebido.</h1>
                  <p className="text-[14px] text-body">
                    Retornamos em breve pelo contato informado.
                  </p>
                  <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
                    <span className="text-[12px] text-muted">
                      Visto pela equipe Azuos — tarefa criada automaticamente
                    </span>
                    <span className="font-semibold text-ink">{done.customId}</span>
                  </div>
                  <Button
                    variant="ghost"
                    className="self-start"
                    onClick={() => {
                      setDone(null);
                      setValues({});
                      setMissing([]);
                    }}
                  >
                    Enviar outra resposta
                  </Button>
                </div>
              ) : (
                <form
                  className="flex flex-col gap-5"
                  onSubmit={(submit) => {
                    submit.preventDefault();

                    const pending = missingAnswers(form.data.fields, form.data.conditions, values);

                    setMissing(pending);

                    if (pending.length === 0) {
                      send.mutate();
                    }
                  }}
                >
                  <div className="flex flex-col gap-2">
                    <h1 className="heading text-2xl md:text-4xl">{form.data.title}</h1>
                    {form.data.description ? (
                      <p className="text-[14px] text-body">{form.data.description}</p>
                    ) : null}
                  </div>

                  <FormFieldsView
                    fields={form.data.fields}
                    conditions={form.data.conditions}
                    values={values}
                    missing={missing}
                    idPrefix="public"
                    onChange={(fieldId, value) => {
                      setValues((current) => ({ ...current, [fieldId]: value }));
                      setMissing((current) => current.filter((id) => id !== fieldId));
                    }}
                  />

                  {/* Honeypot: display:none, fora do olho e do leitor de tela. */}
                  <div aria-hidden="true" className="hidden">
                    <label htmlFor="public-website">Site</label>
                    <input
                      id="public-website"
                      name={HONEYPOT}
                      tabIndex={-1}
                      autoComplete="off"
                      value={honeypot}
                      onChange={(change) => {
                        setHoneypot(change.target.value);
                      }}
                    />
                  </div>

                  {failed ? (
                    <p role="alert" className="text-[13px] text-danger">
                      {failed}
                    </p>
                  ) : null}

                  <Button type="submit" size="lg" disabled={send.isPending}>
                    {send.isPending ? <Spinner label="Enviando" /> : 'Enviar'}
                  </Button>
                </form>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
