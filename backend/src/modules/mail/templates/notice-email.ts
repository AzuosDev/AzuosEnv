import { EmailContent, renderEmailHtml } from './email-layout';

/**
 * Shell for plain-text messages (notifications, reminders) so every mail the
 * system sends carries the same identity, without each caller writing HTML.
 */
export function renderNoticeHtml(subject: string, text: string): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, ' ').trim())
    .filter((paragraph) => paragraph.length > 0);

  const content: EmailContent = {
    preheader: paragraphs[0] ?? subject,
    kind: 'Aviso',
    heading: subject,
    paragraphs,
    footer: [
      'Você recebeu esta mensagem por causa das suas notificações no Azuos Env. É possível ajustá-las nas configurações da conta.',
      'Azuos Env — Azuos Dev',
    ],
  };

  return renderEmailHtml(content);
}
