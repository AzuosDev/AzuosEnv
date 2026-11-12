import type { StatusTone } from '@/components/ui/status-pill';
import type {
  ApiKeyScope,
  AuditAction,
  AuditEntityType,
  OutgoingWebhookEvent,
  WebhookDeliveryStatus,
} from '@/api/types';

/* Webhooks de saída ------------------------------------------------------ */

export const WEBHOOK_EVENTS: OutgoingWebhookEvent[] = [
  '*',
  'task.created',
  'task.updated',
  'task.moved',
  'task.deleted',
  'comment.created',
  'message.created',
  'whiteboard.updated',
];

export const WEBHOOK_EVENT_LABEL: Record<OutgoingWebhookEvent, string> = {
  '*': 'Todos os eventos',
  'task.created': 'Tarefa criada',
  'task.updated': 'Tarefa alterada',
  'task.moved': 'Tarefa movida',
  'task.deleted': 'Tarefa excluída',
  'comment.created': 'Comentário novo',
  'message.created': 'Mensagem no chat',
  'whiteboard.updated': 'Quadro alterado',
};

export const DELIVERY_STATUS_LABEL: Record<WebhookDeliveryStatus, string> = {
  pending: 'Pendente',
  success: 'Entregue',
  failed: 'Falhou',
};

export const DELIVERY_STATUS_TONE: Record<WebhookDeliveryStatus, StatusTone> = {
  pending: 'warning',
  success: 'success',
  failed: 'danger',
};

/* Chaves de API ---------------------------------------------------------- */

export const API_KEY_SCOPES: ApiKeyScope[] = ['read', 'write'];

export const API_KEY_SCOPE_LABEL: Record<ApiKeyScope, string> = {
  read: 'Leitura',
  write: 'Leitura e escrita',
};

/* Auditoria -------------------------------------------------------------- */

export const AUDIT_ACTIONS: AuditAction[] = [
  'workspace.updated',
  'workspace.deleted',
  'workspace.ownership.transferred',
  'workspace.exported',
  'workspace.imported',
  'member.role.changed',
  'member.deactivated',
  'invite.created',
  'invite.revoked',
  'team.deleted',
  'resource.purged',
  'integration.github.created',
  'integration.github.updated',
  'integration.github.deleted',
  'integration.google.disconnected',
  'integration.google.calendar.changed',
  'webhook.created',
  'webhook.updated',
  'webhook.deleted',
  'webhook.redelivered',
];

export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  'workspace.updated': 'Workspace alterado',
  'workspace.deleted': 'Workspace excluído',
  'workspace.ownership.transferred': 'Posse transferida',
  'workspace.exported': 'Workspace exportado',
  'workspace.imported': 'Importação do ClickUp',
  'member.role.changed': 'Papel alterado',
  'member.deactivated': 'Pessoa desativada',
  'invite.created': 'Convite enviado',
  'invite.revoked': 'Convite cancelado',
  'team.deleted': 'Equipe removida',
  'resource.purged': 'Item apagado da lixeira',
  'integration.github.created': 'Repositório ligado',
  'integration.github.updated': 'Integração do GitHub alterada',
  'integration.github.deleted': 'Repositório desligado',
  'integration.google.disconnected': 'Google Agenda desconectado',
  'integration.google.calendar.changed': 'Agenda do Google trocada',
  'webhook.created': 'Webhook criado',
  'webhook.updated': 'Webhook alterado',
  'webhook.deleted': 'Webhook removido',
  'webhook.redelivered': 'Entrega reenviada',
};

export const AUDIT_ENTITY_LABEL: Record<AuditEntityType, string> = {
  workspace: 'Workspace',
  member: 'Pessoa',
  invite: 'Convite',
  team: 'Equipe',
  resource: 'Item',
  integration: 'Integração',
  webhook: 'Webhook',
  import: 'Importação',
  export: 'Exportação',
};

/** Ação que o contrato trouxe sem rótulo ainda aparece legível na tela. */
export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABEL[action as AuditAction] ?? action;
}
