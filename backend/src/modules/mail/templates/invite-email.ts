import { MailMessage } from '../mail.service';
import { EmailContent, renderEmailHtml, renderEmailText } from './email-layout';

export interface InviteEmailInput {
  to: string;
  workspaceName: string;
  roleLabel: string;
  acceptUrl: string;
  expiresInDays: number;
  /** Name of whoever sent the invite, when it is known. */
  inviterName?: string;
}

export function buildInviteEmail(input: InviteEmailInput): MailMessage {
  const invitation = input.inviterName
    ? `${input.inviterName} convidou você para colaborar no workspace ${input.workspaceName}, no Azuos Env.`
    : `Você foi convidado para colaborar no workspace ${input.workspaceName}, no Azuos Env.`;

  const content: EmailContent = {
    preheader: `${invitation} O convite vale por ${input.expiresInDays} dias.`,
    kind: 'Convite',
    heading: `Entre no workspace ${input.workspaceName}`,
    paragraphs: [
      invitation,
      'O Azuos Env reúne tarefas, prazos, tempo, documentos e conversas do projeto em um lugar só. Aceite o convite para ver o que já está em andamento.',
    ],
    details: [
      { label: 'Workspace', value: input.workspaceName },
      { label: 'Seu acesso', value: input.roleLabel },
      { label: 'E-mail convidado', value: input.to },
    ],
    action: {
      label: 'Aceitar convite',
      url: input.acceptUrl,
      fallbackNote: 'Se o botão não funcionar, copie e cole este endereço no navegador:',
    },
    note: `Este convite expira em ${input.expiresInDays} dias e só pode ser usado uma vez.`,
    footer: [
      'Você recebeu esta mensagem porque este endereço foi adicionado a um workspace do Azuos Env. Se não esperava o convite, basta ignorar.',
      'Azuos Env — Azuos Dev',
    ],
  };

  return {
    to: input.to,
    subject: `Convite para o workspace ${input.workspaceName}`,
    text: renderEmailText(content),
    html: renderEmailHtml(content),
  };
}
