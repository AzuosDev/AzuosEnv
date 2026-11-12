import type { CSSProperties } from 'react';
import type { CustomField } from '@/api/types';

/** Soma das faixas fixas (responsáveis, prazo e prioridade) com os vãos. */
const FIXED_COLUMNS = 416;

/** O nome da tarefa nunca abre com menos que isso. */
const NAME_MIN = 200;

/** Largura de uma coluna de campo personalizado, já com o vão. */
const FIELD_COLUMN = 124;

export interface ListLayout {
  /** Falso quando o container é estreito: a linha mostra só o essencial. */
  wide: boolean;
  /** Campos que cabem como coluna nesta largura. */
  fields: CustomField[];
  style: CSSProperties;
}

/**
 * Colunas que cabem na largura do container (não na da janela): com o painel
 * da tarefa aberto a Lista fica estreita mesmo em 1280, e a grade precisa
 * recolher em vez de espremer o nome ou empurrar a página.
 */
export function listLayout(width: number, fields: CustomField[]): ListLayout {
  if (width < FIXED_COLUMNS + NAME_MIN) {
    return { wide: false, fields: [], style: {} };
  }

  const room = Math.floor((width - FIXED_COLUMNS - NAME_MIN) / FIELD_COLUMN);
  const shown = fields.slice(0, Math.max(0, room));
  const tracks = shown.map(() => 'minmax(0,112px)').join(' ');

  return {
    wide: true,
    fields: shown,
    style: {
      gridTemplateColumns: `28px minmax(0,1fr) ${tracks} minmax(0,132px) minmax(0,96px) minmax(0,112px)`,
    },
  };
}
