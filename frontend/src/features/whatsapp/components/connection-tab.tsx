import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Check,
  Copy,
  PlugZap,
  Power,
  QrCode,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import { ApiRequestError, errorMessage } from '@/api/errors';
import type { WaProvider } from '@/api/types';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import {
  adoptWaInstance,
  connectWaConnection,
  disconnectWaConnection,
  restartWaConnection,
  saveWaConnection,
  testWaConnection,
  waConnectionQuery,
  waQrCodeQuery,
} from '../api';
import {
  DEFAULT_WA_PROVIDER,
  WA_CONNECTION_LABEL,
  WA_PROVIDERS,
  WA_PROVIDER_LABEL,
  waCapabilities,
} from '../whatsapp-model';
import { WaCard, WaField, waGhostClass, waInputClass, waPrimaryClass } from './wa-form';

export interface ConnectionTabProps {
  wsId: string;
}

interface FieldSpec {
  key: FieldKey;
  label: string;
  hint: string;
  secret?: boolean;
  placeholder?: string;
}

const EVOLUTION_FIELDS: FieldSpec[] = [
  {
    key: 'baseUrl',
    label: 'URL do servidor',
    hint: 'Origem da Evolution API v2, com https.',
    placeholder: 'https://evolution.seu-dominio.com.br',
  },
  {
    key: 'apiKey',
    label: 'API key',
    hint: 'Chave do servidor; fica criptografada e nunca volta para a tela.',
    secret: true,
  },
  {
    key: 'instanceName',
    label: 'Nome da instância',
    hint: 'Este servidor é compartilhado: o nome precisa estar livre.',
    placeholder: 'azuos-env',
  },
];

const CLOUD_FIELDS: FieldSpec[] = [
  { key: 'phoneNumberId', label: 'Phone Number ID', hint: 'Id do número dentro da WABA.' },
  { key: 'wabaId', label: 'WABA ID', hint: 'Conta do WhatsApp Business.' },
  {
    key: 'accessToken',
    label: 'Token da Graph API',
    hint: 'Token permanente; fica criptografado.',
    secret: true,
  },
  { key: 'appSecret', label: 'App Secret', hint: 'Assina o webhook da Meta.', secret: true },
  { key: 'verifyToken', label: 'Verify token', hint: 'Devolvido na verificação do webhook.' },
];

type FieldKey =
  | 'baseUrl'
  | 'apiKey'
  | 'instanceName'
  | 'phoneNumberId'
  | 'wabaId'
  | 'accessToken'
  | 'appSecret'
  | 'verifyToken';

const EMPTY: Record<FieldKey, string> = {
  baseUrl: '',
  apiKey: '',
  instanceName: '',
  phoneNumberId: '',
  wabaId: '',
  accessToken: '',
  appSecret: '',
  verifyToken: '',
};

/**
 * Aba Conexão (gestor). A Evolution é o padrão: credenciais do servidor, QR Code
 * ao vivo e os botões do pareamento. A Cloud API oficial continua aqui para
 * quem já estava nela, com o webhook para copiar no app da Meta.
 */
export function ConnectionTab({ wsId }: ConnectionTabProps) {
  const queryClient = useQueryClient();
  const query = useQuery(waConnectionQuery(wsId));
  const connection = query.data?.connection ?? null;
  const [provider, setProvider] = useState<WaProvider | null>(null);
  const [values, setValues] = useState<Record<FieldKey, string>>(EMPTY);
  const [saving, setSaving] = useState(false);
  /** Nome recusado por já existir no servidor; a adoção é oferecida a partir dele. */
  const [takenName, setTakenName] = useState('');
  const [busy, setBusy] = useState<'' | 'connect' | 'disconnect' | 'restart' | 'test'>('');
  const [copied, setCopied] = useState(false);

  // Enquanto o gestor não escolhe, vale o provedor já salvo.
  const chosen = provider ?? connection?.provider ?? DEFAULT_WA_PROVIDER;
  const capabilities = waCapabilities(chosen);
  const saved = connection?.provider ?? null;
  const status = connection?.status ?? null;
  const webhookUrl = query.data?.webhookUrl ?? '';
  const fields = chosen === 'cloud' ? CLOUD_FIELDS : EVOLUTION_FIELDS;
  // QR Code e URL do webhook: só a Evolution tem os dois.
  const qr = useQuery(waQrCodeQuery(wsId, saved === 'evolution'));

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['workspaces', wsId, 'whatsapp'] });
  };

  const run = (
    kind: 'connect' | 'disconnect' | 'restart' | 'test',
    action: () => Promise<unknown>,
    done: string,
  ): void => {
    setBusy(kind);
    void action()
      .then(() => {
        refresh();
        toast.success(done);
      })
      .catch((error: unknown) => {
        toast.error(errorMessage(error));
      })
      .finally(() => {
        setBusy('');
      });
  };

  const save = (): void => {
    const missing = fields.filter((field) => values[field.key].trim() === '');

    if (missing.length > 0) {
      toast.error('Preencha todos os campos da conexão.');

      return;
    }

    const body =
      chosen === 'cloud'
        ? {
            provider: 'cloud' as const,
            phoneNumberId: values.phoneNumberId.trim(),
            wabaId: values.wabaId.trim(),
            accessToken: values.accessToken.trim(),
            appSecret: values.appSecret.trim(),
            verifyToken: values.verifyToken.trim(),
          }
        : {
            provider: 'evolution' as const,
            baseUrl: values.baseUrl.trim().replace(/\/$/, ''),
            apiKey: values.apiKey.trim(),
            instanceName: values.instanceName.trim(),
          };

    setSaving(true);
    setTakenName('');
    void saveWaConnection(wsId, body)
      .then(() => {
        refresh();
        setValues(EMPTY);
        toast.success('Conexão salva.');
      })
      .catch((error: unknown) => {
        // Nome em uso não é fim de linha: ou o gestor troca o nome, ou diz que a
        // instância é dele e a adota.
        if (error instanceof ApiRequestError && error.code === 'WHATSAPP_INSTANCE_IN_USE') {
          setTakenName(values.instanceName.trim());
        }

        toast.error(errorMessage(error));
      })
      .finally(() => {
        setSaving(false);
      });
  };

  /** Salva aceitando o nome existente e assume a instância, nesta ordem. */
  const adopt = (): void => {
    setSaving(true);
    void saveWaConnection(wsId, {
      provider: 'evolution',
      baseUrl: values.baseUrl.trim().replace(/\/$/, ''),
      apiKey: values.apiKey.trim(),
      instanceName: takenName,
      adoptExisting: true,
    })
      .then(() => adoptWaInstance(wsId))
      .then(() => {
        refresh();
        setValues(EMPTY);
        setTakenName('');
        toast.success('Instância assumida pelo Azuos Env.');
      })
      .catch((error: unknown) => {
        toast.error(errorMessage(error));
      })
      .finally(() => {
        setSaving(false);
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
      <WaCard
        title="Número conectado"
        hint={saved ? WA_PROVIDER_LABEL[saved] : 'Nenhum provedor salvo ainda.'}
      >
        <dl className="flex flex-col gap-2 text-[13px]">
          <Row label="Número" value={connection?.displayPhone || '—'} />
          <Row label="Nome do perfil" value={connection?.verifiedName || '—'} />
          <Row
            label="Estado"
            value={status ? capitalize(WA_CONNECTION_LABEL[status]) : 'Sem conexão'}
          />
          {connection?.lastError ? (
            <Row label="Último erro" value={connection.lastError} tone="danger" />
          ) : null}
        </dl>

        {saved === 'evolution' ? (
          <div className="flex flex-col gap-3">
            {status === 'connected' ? null : (
              <QrPanel
                qrCode={qr.data?.qrCode ?? null}
                loading={busy === 'connect'}
                onConnect={() => {
                  run('connect', () => connectWaConnection(wsId), 'Leia o QR Code no celular.');
                }}
              />
            )}

            <WaField
              label="URL do webhook"
              hint="Gravada na instância ao conectar; só o gestor vê."
            >
              <input
                readOnly
                value={qr.data?.webhookUrl ?? ''}
                className={`${waInputClass} min-w-0`}
              />
            </WaField>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy !== ''}
                onClick={() => {
                  run('restart', () => restartWaConnection(wsId), 'Instância reiniciada.');
                }}
                className={waGhostClass}
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                {busy === 'restart' ? 'Reiniciando…' : 'Reiniciar'}
              </button>
              <button
                type="button"
                disabled={busy !== '' || !connection}
                onClick={() => {
                  run('disconnect', () => disconnectWaConnection(wsId), 'Número desconectado.');
                }}
                className={waGhostClass}
              >
                <Power className="h-4 w-4" aria-hidden="true" />
                {busy === 'disconnect' ? 'Desconectando…' : 'Desconectar'}
              </button>
            </div>
          </div>
        ) : null}

        {saved === 'cloud' ? (
          <div className="flex flex-col gap-2">
            <WaField label="URL do webhook" hint="Cole no app da Meta.">
              <span className="flex gap-2">
                <input readOnly value={webhookUrl} className={`${waInputClass} min-w-0 flex-1`} />
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
            </WaField>

            <button
              type="button"
              disabled={busy !== '' || !connection}
              onClick={() => {
                run('test', () => testWaConnection(wsId), 'Número conferido na Graph API.');
              }}
              className={`${waGhostClass} self-start`}
            >
              <PlugZap className="h-4 w-4" aria-hidden="true" />
              {busy === 'test' ? 'Testando…' : 'Testar conexão'}
            </button>
          </div>
        ) : null}
      </WaCard>

      <WaCard
        title="Credenciais"
        hint="Chaves e tokens são guardados criptografados e nunca voltam para a tela."
      >
        <div className="flex flex-col gap-3">
          <WaField label="Provedor" hint="A Evolution conecta lendo um QR Code no celular.">
            <select
              value={chosen}
              onChange={(event) => {
                setProvider(event.target.value as WaProvider);
                setValues(EMPTY);
              }}
              className={waInputClass}
            >
              {WA_PROVIDERS.map((one) => (
                <option key={one} value={one}>
                  {WA_PROVIDER_LABEL[one]}
                </option>
              ))}
            </select>
          </WaField>

          {capabilities.qrCode ? <UnofficialWarning /> : null}

          {takenName ? <AdoptNotice name={takenName} busy={saving} onAdopt={adopt} /> : null}

          {fields.map((field) => (
            <WaField key={field.key} label={field.label} hint={field.hint}>
              <Input
                value={values[field.key]}
                type={field.secret ? 'password' : 'text'}
                autoComplete="off"
                placeholder={field.secret ? '••••••••' : (field.placeholder ?? '')}
                onChange={(event) => {
                  setValues((current) => ({ ...current, [field.key]: event.target.value }));
                }}
                className="border-wa-line bg-wa-header text-wa-text"
              />
            </WaField>
          ))}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={save}
              className={saved ? waGhostClass : waPrimaryClass}
            >
              {saving ? 'Salvando…' : 'Salvar conexão'}
            </button>

            {saved ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  // Trocar é começar outro cadastro: os campos voltam em branco
                  // para o gestor digitar outro servidor ou outra instância.
                  setValues(EMPTY);
                  setTakenName('');
                  setProvider(null);
                }}
                className={waGhostClass}
              >
                Trocar a conexão
              </button>
            ) : null}
          </div>
        </div>
      </WaCard>
    </div>
  );
}

interface RowProps {
  label: string;
  value: string;
  tone?: 'danger';
}

function Row({ label, value, tone }: RowProps) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-wa-muted">{label}</dt>
      <dd className={tone === 'danger' ? 'text-right text-danger' : 'text-right text-wa-text'}>
        {value}
      </dd>
    </div>
  );
}

interface QrPanelProps {
  qrCode: string | null;
  loading: boolean;
  onConnect: () => void;
}

/**
 * O QR Code vive pouco: a Evolution troca a imagem a cada poucos segundos e o
 * socket avisa, então a tela só mostra a última que chegou.
 */
function QrPanel({ qrCode, loading, onConnect }: QrPanelProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-wa-line bg-wa-header p-4">
      {qrCode ? (
        <>
          <img
            src={qrCode}
            alt="QR Code para conectar o WhatsApp"
            className="h-48 w-48 rounded-lg bg-white p-2"
          />
          <p className="text-center text-[13px] text-wa-muted">
            No celular: WhatsApp › Aparelhos conectados › Conectar aparelho.
          </p>
        </>
      ) : (
        <p className="text-center text-[13px] text-wa-muted">
          Clique em Conectar para gerar o QR Code do pareamento.
        </p>
      )}

      <button type="button" disabled={loading} onClick={onConnect} className={waPrimaryClass}>
        <QrCode className="h-4 w-4" aria-hidden="true" />
        {loading ? 'Gerando…' : qrCode ? 'Gerar outro QR Code' : 'Conectar'}
      </button>
    </div>
  );
}

interface AdoptNoticeProps {
  name: string;
  busy: boolean;
  onAdopt: () => void;
}

/**
 * O nome já existe no servidor, que é compartilhado. O caminho normal é trocar
 * de nome; adotar é para quem preparou a instância à mão antes do app, e custa
 * os eventos de quem estiver usando essa instância hoje — por isso está escrito.
 */
function AdoptNotice({ name, busy, onAdopt }: AdoptNoticeProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning/15 p-3">
      <p className="flex items-start gap-2 text-[13px] text-wa-text">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
        <span>
          A instância <strong className="font-semibold">{name}</strong> já existe neste servidor.
          Escolha outro nome, ou assuma esta se ela for sua: o webhook dela passa a apontar para o
          Azuos Env e qualquer outro sistema ligado nela para de receber as mensagens.
        </span>
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={onAdopt}
        className={`${waGhostClass} self-start`}
      >
        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        {busy ? 'Assumindo…' : 'Assumir esta instância'}
      </button>
    </div>
  );
}

/** Aviso fixo: a conexão por QR Code não é oficial. */
function UnofficialWarning() {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/15 p-3 text-[13px] text-wa-text">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
      <span>
        Conexão não oficial: o número pode ser banido pelo WhatsApp. Evite disparos em massa.
      </span>
    </p>
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
