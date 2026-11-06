import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Download, FileText, Image as ImageIcon, Paperclip, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { Attachment, WorkspaceMemberItem } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import {
  attachmentsQuery,
  deleteAttachment,
  downloadAttachment,
  uploadAttachment,
} from '../collaboration-api';

/** Teto do upload no backend: 25 MB por arquivo. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * Quantas prévias o painel baixa sozinho. A prévia precisa dos bytes
 * autenticados, então uma tarefa cheia de prints não dispara dezenas de
 * downloads; o resto da lista fica com ícone, nome e o botão de baixar.
 */
export const PREVIEW_BUDGET = 6;

export interface AttachmentsSectionProps {
  wsId: string;
  customId: string;
  members: WorkspaceMemberItem[];
  /** Falso quando o papel não permite editar a tarefa. */
  canWrite: boolean;
  onChanged: () => void;
}

interface PendingUpload {
  id: string;
  name: string;
  /** 0 a 1. */
  ratio: number;
}

export function formatBytes(size: number): string {
  if (size < 1024) {
    return `${String(size)} B`;
  }

  const units = ['kB', 'MB', 'GB'];
  let value = size / 1024;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${units[unit] ?? 'kB'}`;
}

export function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export function isPdf(mimeType: string): boolean {
  return mimeType === 'application/pdf';
}

/** Baixa os bytes autenticados e devolve uma URL local enquanto o item existe. */
function useBlobUrl(wsId: string, attachment: Attachment, enabled: boolean): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    void downloadAttachment(wsId, attachment.id)
      .then((blob) => {
        if (cancelled) {
          return;
        }

        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        // Sem prévia: a linha continua com ícone, nome e download.
      });

    return () => {
      cancelled = true;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }

      setUrl(null);
    };
  }, [wsId, attachment.id, enabled]);

  return url;
}

/** Salva o arquivo no computador pelo blob já autenticado. */
async function saveFile(wsId: string, attachment: Attachment): Promise<void> {
  const blob = await downloadAttachment(wsId, attachment.id);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = attachment.name;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function AttachmentRow({
  wsId,
  attachment,
  members,
  canWrite,
  withPreview,
  onRemove,
  removing,
}: {
  wsId: string;
  attachment: Attachment;
  members: WorkspaceMemberItem[];
  canWrite: boolean;
  /** Falso além do orçamento de prévias: a linha fica só com ícone e ações. */
  withPreview: boolean;
  onRemove: () => void;
  removing: boolean;
}) {
  const image = isImage(attachment.mimeType);
  const pdf = isPdf(attachment.mimeType);
  const preview = useBlobUrl(wsId, attachment, withPreview && (image || pdf));
  const author = members.find(
    (member) => member.userId.id === String(attachment.uploadedBy),
  )?.userId;
  const Icon = image ? ImageIcon : FileText;
  const [saving, setSaving] = useState(false);

  const download = (): void => {
    setSaving(true);
    void saveFile(wsId, attachment)
      .catch((error: unknown) => {
        toast.error(errorMessage(error, 'Não foi possível baixar o arquivo.'));
      })
      .finally(() => {
        setSaving(false);
      });
  };

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] text-ink">{attachment.name}</span>
          <span className="block truncate text-[12px] text-muted">
            {formatBytes(attachment.size)}
            {author ? ` · ${author.name}` : ''} ·{' '}
            {format(new Date(attachment.createdAt), 'd MMM yyyy, HH:mm', { locale: ptBR })}
          </span>
        </span>

        <Button
          variant="nav"
          size="icon"
          aria-label={`Baixar ${attachment.name}`}
          className="h-11 w-11 shrink-0 md:h-9 md:w-9"
          disabled={saving}
          onClick={download}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
        </Button>

        {canWrite ? (
          <Button
            variant="nav"
            size="icon"
            aria-label={`Excluir ${attachment.name}`}
            className="h-11 w-11 shrink-0 md:h-9 md:w-9"
            disabled={removing}
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : null}
      </div>

      {image && preview ? (
        <img
          src={preview}
          alt={attachment.name}
          className="max-h-56 w-full rounded-lg border border-line object-contain"
        />
      ) : null}

      {pdf && preview ? (
        <iframe
          src={preview}
          title={`Prévia de ${attachment.name}`}
          className="h-56 w-full rounded-lg border border-line bg-paper-2"
        />
      ) : null}
    </li>
  );
}

/**
 * Anexos da tarefa: arrastar e soltar, colar print, barra de progresso, prévia
 * de imagem e PDF, baixar e excluir.
 */
export function AttachmentsSection({
  wsId,
  customId,
  members,
  canWrite,
  onChanged,
}: AttachmentsSectionProps) {
  const queryClient = useQueryClient();
  const attachments = useQuery(attachmentsQuery(wsId, customId));
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.attachments(wsId, customId) });
    onChanged();
  };

  const send = async (files: File[]): Promise<void> => {
    const accepted = files.filter((file) => {
      if (file.size <= MAX_UPLOAD_BYTES) {
        return true;
      }

      toast.error(`${file.name} passa de ${formatBytes(MAX_UPLOAD_BYTES)}.`);

      return false;
    });

    if (accepted.length === 0) {
      return;
    }

    for (const file of accepted) {
      const id = `${file.name}-${String(Date.now())}-${String(Math.random())}`;

      setUploads((current) => [...current, { id, name: file.name, ratio: 0 }]);

      try {
        await uploadAttachment(wsId, customId, file, {
          onProgress: (ratio) => {
            setUploads((current) =>
              current.map((item) => (item.id === id ? { ...item, ratio } : item)),
            );
          },
        });
      } catch (error) {
        toast.error(errorMessage(error, `Não foi possível enviar ${file.name}.`));
      } finally {
        setUploads((current) => current.filter((item) => item.id !== id));
      }
    }

    refresh();
  };

  // O listener de colar é fixo; o envio atual entra por referência.
  const sendRef = useRef(send);

  sendRef.current = send;

  const remove = useMutation({
    mutationFn: (attachmentId: string) => deleteAttachment(wsId, attachmentId),
    onSuccess: () => {
      refresh();
      toast.success('Anexo excluído.');
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  // Colar print: o Ctrl+V da página vira anexo, menos dentro de um campo de texto.
  useEffect(() => {
    if (!canWrite) {
      return;
    }

    const onPaste = (event: ClipboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const typing = Boolean(
        target?.closest('input, textarea, [contenteditable="true"], [role="textbox"]'),
      );
      const files = [...(event.clipboardData?.files ?? [])];

      if (typing || files.length === 0) {
        return;
      }

      event.preventDefault();
      void sendRef.current(files);
    };

    window.addEventListener('paste', onPaste);

    return () => {
      window.removeEventListener('paste', onPaste);
    };
  }, [canWrite]);

  const items = attachments.data ?? [];

  return (
    <section aria-labelledby="task-attachments-heading" className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Paperclip className="h-4 w-4 text-muted" aria-hidden="true" />
        <h2 id="task-attachments-heading" className="text-[12.5px] font-semibold text-muted">
          Anexos
        </h2>
        <span className="text-[12px] text-muted">{items.length}</span>
      </div>

      {canWrite ? (
        <div
          className={cn(
            'flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line p-4 text-center',
            dragging && 'border-accent bg-surface-2',
          )}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => {
            setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void send([...event.dataTransfer.files]);
          }}
        >
          <p className="text-[12.5px] text-muted">
            Arraste arquivos aqui, cole um print ou escolha no computador. Até{' '}
            {formatBytes(MAX_UPLOAD_BYTES)} por arquivo.
          </p>

          <label className="sr-only" htmlFor="task-attachment-input">
            Escolher arquivos para anexar
          </label>
          <input
            ref={inputRef}
            id="task-attachment-input"
            type="file"
            multiple
            className="sr-only"
            onChange={(event) => {
              void send([...(event.target.files ?? [])]);
              event.target.value = '';
            }}
          />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              inputRef.current?.click();
            }}
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            Escolher arquivos
          </Button>
        </div>
      ) : null}

      {uploads.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {uploads.map((upload) => (
            <li key={upload.id} className="flex flex-col gap-1">
              <span className="flex items-center justify-between gap-2 text-[12.5px] text-body">
                <span className="min-w-0 truncate">{upload.name}</span>
                <span className="shrink-0 text-muted">
                  {String(Math.round(upload.ratio * 100))}%
                </span>
              </span>
              <span
                role="progressbar"
                aria-label={`Enviando ${upload.name}`}
                aria-valuenow={Math.round(upload.ratio * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                className="block h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
              >
                <span
                  className="block h-full rounded-full bg-accent transition-[width]"
                  style={{ width: `${String(Math.round(upload.ratio * 100))}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {attachments.isPending ? <Spinner label="Carregando os anexos" /> : null}

      {!attachments.isPending && items.length === 0 && uploads.length === 0 ? (
        <p className="text-[13px] text-muted">Nenhum anexo nesta tarefa.</p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {items.map((attachment, index) => (
          <AttachmentRow
            key={attachment.id}
            wsId={wsId}
            attachment={attachment}
            members={members}
            canWrite={canWrite}
            withPreview={index < PREVIEW_BUDGET}
            removing={remove.isPending && remove.variables === attachment.id}
            onRemove={() => {
              remove.mutate(attachment.id);
            }}
          />
        ))}
      </ul>
    </section>
  );
}
