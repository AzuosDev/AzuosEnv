import { describe, expect, it } from 'vitest';
import type { Status } from '@/api/types';
import {
  addStatus,
  draftFromStatuses,
  moveStatus,
  patchStatus,
  removeStatus,
  toStatusInputs,
  validateDraft,
} from './status-draft';

const statuses: Status[] = [
  { id: '1', name: 'Em andamento', color: '#2563EB', group: 'active', position: 1 },
  { id: '2', name: 'A fazer', color: '#94A3B8', group: 'notStarted', position: 0 },
  { id: '3', name: 'Concluído', color: '#16A34A', group: 'done', position: 2 },
];

describe('status-draft', () => {
  it('lê o conjunto na ordem salva', () => {
    expect(draftFromStatuses(statuses).map((status) => status.name)).toEqual([
      'A fazer',
      'Em andamento',
      'Concluído',
    ]);
  });

  it('adiciona, renomeia, troca grupo e remove', () => {
    let draft = addStatus(draftFromStatuses(statuses));
    const added = draft[draft.length - 1];

    expect(added?.id).toBeUndefined();

    draft = patchStatus(draft, added?.key ?? '', { name: 'Bloqueado', group: 'closed' });
    expect(draft[3]).toMatchObject({ name: 'Bloqueado', group: 'closed' });

    draft = removeStatus(draft, '2');
    expect(draft.map((status) => status.name)).toEqual(['Em andamento', 'Concluído', 'Bloqueado']);
  });

  it('move para cima e para baixo sem sair das bordas', () => {
    const draft = draftFromStatuses(statuses);

    expect(moveStatus(draft, '1', -1).map((status) => status.id)).toEqual(['1', '2', '3']);
    expect(moveStatus(draft, '2', -1)).toBe(draft);
    expect(moveStatus(draft, '3', 1)).toBe(draft);
  });

  it('cobra nome, nome único, limite e um status de Concluído', () => {
    const draft = draftFromStatuses(statuses);

    expect(validateDraft(draft)).toBeNull();
    expect(validateDraft([])).toMatch(/ao menos um status/);
    expect(validateDraft(patchStatus(draft, '1', { name: '  ' }))).toMatch(/Dê um nome/);
    expect(validateDraft(patchStatus(draft, '1', { name: 'a fazer' }))).toMatch(/Já existe/);
    expect(validateDraft(removeStatus(draft, '3'))).toMatch(/Concluído/);
  });

  it('manda o id só de quem já existia', () => {
    const draft = addStatus(draftFromStatuses(statuses).slice(0, 1));
    const body = toStatusInputs(patchStatus(draft, draft[1]?.key ?? '', { name: ' Novo ' }));

    expect(body[0]).toMatchObject({ id: '2', name: 'A fazer' });
    expect(body[1]).toEqual({ name: 'Novo', color: '#2563EB', group: 'active' });
  });
});
