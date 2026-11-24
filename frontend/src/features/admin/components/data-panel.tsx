import { useMutation, useQuery } from '@tanstack/react-query';
import { useId, useRef, useState } from 'react';
import { errorMessage } from '@/api/errors';
import type { ImportReport } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SelectNative } from '@/components/ui/select-native';
import { StatusPill } from '@/components/ui/status-pill';
import { toast } from '@/components/ui/toast';
import { SettingsCard, SettingsRow } from '@/features/settings/components/settings-card';
import { membersQuery } from '@/features/settings/api';
import { treeQuery } from '@/features/shell/api';
import { MAX_IMPORT_BYTES, previewClickUpCsv, type ImportPreview } from '../clickup-csv';
import { exportWorkspace, importClickUpCsv } from '../api';

function listLine(label: string, values: string[]): string {
  if (values.length === 0) {
    return `${label}: nada`;
  }

  const shown = values.slice(0, 6).join(', ');

  return values.length > 6
    ? `${label}: ${shown} e mais ${String(values.length - 6)}`
    : `${label}: ${shown}`;
}

function normalizePerson(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase();
}

/** Importação do ClickUp por CSV, com prévia, e exportação do workspace. */
export function DataPanel({ wsId }: { wsId: string }) {
  const spaceId = useId();
  const fileId = useId();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const tree = useQuery(treeQuery(wsId));
  const members = useQuery(membersQuery(wsId));
  const [space, setSpace] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);

  const spaces = tree.data?.spaces ?? [];
  const target = space;
  const unmatchedPeople = (preview?.people ?? []).filter((person) => {
    const key = normalizePerson(person);
    return !members.data?.some(
      (member) =>
        member.status === 'active' &&
        [member.userId.name, member.userId.email].some((value) => normalizePerson(value) === key),
    );
  });

  const runImport = useMutation({
    mutationFn: () => {
      if (!file) {
        throw new Error('Escolha o arquivo CSV.');
      }

      return importClickUpCsv(wsId, target || undefined, file);
    },
    onSuccess: (result) => {
      setReport(result);
      setFile(null);
      setPreview(null);

      if (fileRef.current) {
        fileRef.current.value = '';
      }

      toast.success(`Importado: ${String(result.tasks)} tarefas.`);
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const download = useMutation({
    mutationFn: () => exportWorkspace(wsId),
    onSuccess: (result) => {
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = `azuos-env-${wsId}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Export gerado.');
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const choose = (chosen: File | null): void => {
    setReport(null);
    setFile(chosen);

    if (!chosen) {
      setPreview(null);

      return;
    }

    if (chosen.size > MAX_IMPORT_BYTES) {
      setPreview(null);
      toast.error('O arquivo passa de 5 MB.');

      return;
    }

    void chosen.text().then(
      (content) => {
        setPreview(previewClickUpCsv(content));
      },
      () => {
        toast.error('Não foi possível ler o arquivo.');
      },
    );
  };

  return (
    <>
      <SettingsCard
        title="Importar do ClickUp"
        description="Exporte as tarefas no ClickUp em CSV e envie o arquivo aqui."
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={spaceId}>Space que recebe (opcional)</Label>
            <SelectNative
              id={spaceId}
              value={target}
              onChange={(event) => {
                setSpace(event.target.value);
              }}
            >
              <option value="">Usar Space do arquivo</option>
              {spaces.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </SelectNative>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={fileId}>Arquivo CSV</Label>
            <input
              ref={fileRef}
              id={fileId}
              type="file"
              accept=".csv,text/csv"
              className="min-h-11 rounded-xl border border-line bg-surface px-3 py-2 text-[13px] text-body file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-ink"
              onChange={(event) => {
                choose(event.target.files?.[0] ?? null);
              }}
            />
          </div>

          {preview ? (
            <div
              className="flex flex-col gap-2 rounded-xl border border-line bg-surface-2 p-3"
              aria-label="Prévia do mapeamento"
              role="group"
            >
              <p className="text-[13px] font-semibold text-ink">
                Prévia: {String(preview.taskCount)} tarefas · {String(preview.spaces.length)} Spaces
                · {String(preview.lists.length)} Lists
              </p>
              <p className="text-[12.5px] text-muted">
                {listLine('Spaces', preview.spaces)} · {listLine('Lists', preview.lists)}
              </p>
              <p className="text-[12.5px] text-muted">{listLine('Folders', preview.folders)}</p>
              <p className="text-[12.5px] text-muted">{listLine('Statuses', preview.statuses)}</p>
              <p className="text-[12.5px] text-muted">
                {listLine('Pessoas no arquivo', preview.people)}
              </p>
              <p className="text-[12.5px] text-muted">
                {listLine(
                  'Responsáveis por e-mail',
                  preview.people.filter((person) => /^[\w.+-]+@[\w-]+\.[\w.-]+$/i.test(person)),
                )}
              </p>
              {members.isSuccess ? (
                <p className="text-[12.5px] text-warning">
                  {listLine('Pessoas não encontradas', unmatchedPeople)}
                </p>
              ) : null}
              {members.isLoading ? (
                <p className="text-[12.5px] text-muted">Validando responsáveis no workspace…</p>
              ) : null}
              {members.isError ? (
                <p className="text-[12.5px] text-danger">
                  Não foi possível validar os responsáveis. Tente novamente antes de confirmar.
                </p>
              ) : null}
              <p className="text-[12.5px] text-muted">{listLine('Etiquetas', preview.tags)}</p>
              {preview.ignoredColumns.length > 0 ? (
                <p className="text-[12.5px] text-muted">
                  {listLine('Colunas ignoradas', preview.ignoredColumns)}
                </p>
              ) : null}
              {preview.skipped.length > 0 ? (
                <p className="text-[12.5px] text-warning">
                  {String(preview.skipped.length)} linha(s) serão ignoradas: linha{' '}
                  {preview.skipped
                    .slice(0, 5)
                    .map((row) => String(row.line))
                    .join(', ')}
                  .
                </p>
              ) : null}
              <p className="text-[12px] text-muted">
                Statuses do arquivo são mantidos na List. Pessoas não encontradas ficam sem
                responsável e constam no relatório.
              </p>
            </div>
          ) : null}

          <Button
            variant="signal"
            className="self-start"
            disabled={!file || !preview || !members.isSuccess || runImport.isPending}
            onClick={() => {
              runImport.mutate();
            }}
          >
            Confirmar importação
          </Button>

          {report ? (
            <div
              className="flex flex-col gap-2 rounded-xl border border-line bg-surface-2 p-3"
              role="status"
              aria-label="Relatório da importação"
            >
              <span className="flex flex-wrap gap-2">
                <StatusPill tone="success">{String(report.tasks)} tarefas</StatusPill>
                <StatusPill>{String(report.lists)} Lists</StatusPill>
                <StatusPill>{String(report.folders)} Folders</StatusPill>
                <StatusPill>{String(report.tags)} etiquetas</StatusPill>
                <StatusPill tone={report.skipped.length > 0 ? 'warning' : 'neutral'}>
                  {String(report.skipped.length)} ignoradas
                </StatusPill>
              </span>
              {report.skipped.length > 0 ? (
                <ul className="flex flex-col gap-1">
                  {report.skipped.slice(0, 20).map((row) => (
                    <li key={`skip-${String(row.line)}`} className="text-[12.5px] text-muted">
                      Linha {row.line}: {row.reason}
                    </li>
                  ))}
                </ul>
              ) : null}
              {report.warnings.length > 0 ? (
                <ul className="flex flex-col gap-1">
                  {report.warnings.slice(0, 20).map((row) => (
                    <li key={`warn-${String(row.line)}`} className="text-[12.5px] text-muted">
                      Linha {row.line}: {row.reason}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </SettingsCard>

      <SettingsCard
        title="Exportar workspace"
        description="Um JSON com tudo o que o workspace guarda, sem nenhum segredo."
      >
        <SettingsRow
          last
          title="Baixar JSON"
          description="Serve de backup e de ponte para outro sistema."
          control={
            <Button
              size="sm"
              disabled={download.isPending}
              onClick={() => {
                download.mutate();
              }}
            >
              Exportar
            </Button>
          }
        />
      </SettingsCard>
    </>
  );
}
