import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, PlugZap } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '@/api/errors';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { saveWaConnection, testWaConnection, waConnectionQuery } from '../api';

export interface ConnectionTabProps {
  wsId: string;
}

const FIELDS = [
  {
    key: 'phoneNumberId',
    label: 'Phone Number ID',
    hint: 'Id do número dentro da WABA.',
    secret: false,
  },
  { key: 'wabaId', label: 'WABA ID', hint: 'Conta do WhatsApp Business.', secret: false },
  {
    key: 'accessToken',
    label: 'Token da Graph API',
    hint: 'Token permanente; fica criptografado.',
    secret: true,
  },
  {
    key: 'appSecret',
    label: 'App Secret',
    hint: 'Assina o webhook da Meta.',
    secret: true,
  },
  {
    key: 'verifyToken',
    label: 'Verify token',
    hint: 'Devolvido na verificação do webhook.',
    secret: false,
  },
] as const;

type FieldKey = (typeof FIELDS)[number]['key'];

/** Aba Conexão (gestor): credenciais da Cloud API, webhook e teste. */
export function ConnectionTab({ wsId }: ConnectionTabProps) {
  const queryClient = useQueryClient();
  const query = useQuery(waConnectionQuery(wsId));
  const [values, setValues] = useState<Record<FieldKey, string>>({
    phoneNumberId: '',
    wabaId: '',
    accessToken: '',
    appSecret: '',
    verifyToken: '',
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);

  const connection = query.data?.connection ?? null;
  const webhookUrl = query.data?.webhookUrl ?? '';

  const set = (key: FieldKey, value: string): void => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const save = (): void => {
    const missing = FIELDS.filter((field) => values[field.key].trim() === '');

    if (missing.length > 0) {
      toast.error('Preencha todos os campos da conexão.');

      return;
    }

    setSaving(true);
    void saveWaConnection(wsId, {
      phoneNumberId: values.phoneNumberId.trim(),
      wabaId: values.wabaId.trim(),
      accessToken: values.accessToken.trim(),
      appSecret: values.appSecret.trim(),
      verifyToken: values.verifyToken.trim(),
    })
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ['workspaces', wsId, 'whatsapp'] });
        setValues({
          phoneNumberId: '',
          wabaId: '',
          accessToken: '',
          appSecret: '',
          verifyToken: '',
        });
        toast.success('Conexão salva.');
      })
      .catch((error: unknown) => {
        toast.error(errorMessage(error));
      })
      .finally(() => {
        setSaving(false);
      });
  };

  const test = (): void => {
    setTesting(true);
    void testWaConnection(wsId)
      .then((status) => {
        void queryClient.invalidateQueries({ queryKey: ['workspaces', wsId, 'whatsapp'] });
        toast.success(
          status.connection?.status === 'connected'
            ? 'Número conectado na Graph API.'
            : 'A Meta respondeu, mas o número não está conectado.',
        );
      })
      .catch((error: unknown) => {
        toast.error(errorMessage(error));
      })
      .finally(() => {
        setTesting(false);
      });
  };

  const copy = (): void => {
    void navigator.clipboard
      .writeText(webhookUrl)
      .then(() => {
        setCopied(true);
        toast.success('URL do webhook copiada.');
        window.setTimeout(() => {
          setCopied(false);
        }, 2000);
      })
      .catch(() => {
        toast.error('Não foi possível copiar a URL.');
      });
  };

  if (query.isPending) {
    return (
      <div className="p-4">
        <Spinner label="Carregando a conexão" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-wa-bg p-3 md:p-4">
      <section className="rounded-2xl border border-wa-line bg-wa-panel p-4 md:p-5">
        <h2 className="text-[15px] font-semibold text-wa-text">Número conectado</h2>
        <dl className="mt-3 flex flex-col gap-2 text-[13px]">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-wa-muted">Número</dt>
            <dd className="text-right text-wa-text">{connection?.displayPhone || '—'}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-wa-muted">Nome verificado</dt>
            <dd className="text-right text-wa-text">{connection?.verifiedName || '—'}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-wa-muted">Estado</dt>
            <dd className="text-right text-wa-text">
              {connection?.status === 'connected'
                ? 'Conectado'
                : connection?.status === 'error'
                  ? 'Com erro'
                  : connection
                    ? 'Pendente'
                    : 'Sem conexão'}
            </dd>
          </div>
          {connection?.lastError ? (
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-wa-muted">Último erro</dt>
              <dd className="text-right text-danger">{connection.lastError}</dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-4 flex flex-col gap-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-wa-text">URL do webhook</span>
            <span className="flex gap-2">
              <input
                readOnly
                value={webhookUrl}
                className="h-11 min-w-0 flex-1 rounded-xl border border-wa-line bg-wa-header px-3 text-wa-text outline-none md:h-10"
              />
              <button
                type="button"
                onClick={copy}
                aria-label="Copiar a URL do webhook"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-wa-line text-wa-text md:h-10 md:w-10"
              >
                {copied ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </span>
          </label>

          <button
            type="button"
            onClick={test}
            disabled={testing || !connection}
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-wa-line px-4 font-semibold text-wa-text disabled:opacity-45 md:h-10"
          >
            <PlugZap className="h-4 w-4" aria-hidden="true" />
            {testing ? 'Testando…' : 'Testar conexão'}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-wa-line bg-wa-panel p-4 md:p-5">
        <h2 className="text-[15px] font-semibold text-wa-text">Credenciais da Cloud API</h2>
        <p className="mt-1 text-[13px] text-wa-muted">
          Token e App Secret são guardados criptografados e nunca voltam para a tela.
        </p>

        <div className="mt-3 flex flex-col gap-3">
          {FIELDS.map((field) => (
            <label key={field.key} className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-wa-text">{field.label}</span>
              <Input
                value={values[field.key]}
                type={field.secret ? 'password' : 'text'}
                autoComplete="off"
                placeholder={field.secret ? '••••••••' : ''}
                onChange={(event) => {
                  set(field.key, event.target.value);
                }}
                className="border-wa-line bg-wa-header text-wa-text"
              />
              <span className="text-[12px] text-wa-muted">{field.hint}</span>
            </label>
          ))}

          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="flex h-11 items-center justify-center self-start rounded-xl bg-wa-accent px-4 font-semibold text-wa-panel disabled:opacity-45 md:h-10"
          >
            Salvar conexão
          </button>
        </div>
      </section>
    </div>
  );
}
