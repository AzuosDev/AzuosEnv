import { MailMessage } from '../mail.service';
import { EmailContent, renderEmailHtml, renderEmailText } from './email-layout';

export interface PasswordResetEmailInput {
  to: string;
  resetUrl: string;
  expiresInMinutes: number;
  /** Nome de quem pediu, quando conhecido. */
  name?: string;
}

export function buildPasswordResetEmail(input: PasswordResetEmailInput): MailMessage {
  const greeting = input.name
    ? `${input.name}, recebemos um pedido para redefinir a senha da sua conta no Azuos Env.`
    : 'Recebemos um pedido para redefinir a senha da sua conta no Azuos Env.';

  const content: EmailContent = {
    preheader: `${greeting} O link vale por ${input.expiresInMinutes} minutos.`,
    kind: 'Senha',
    heading: 'Redefinir sua senha',
    paragraphs: [
      greeting,
      'Clique no botão abaixo para escolher uma senha nova. Por segurança, ao redefinir a senha todas as sessões abertas são encerradas.',
    ],
    details: [{ label: 'Conta', value: input.to }],
    action: {
      label: 'Redefinir senha',
      url: input.resetUrl,
      fallbackNote: 'Se o botão não funcionar, copie e cole este endereço no navegador:',
    },
    note: `Este link expira em ${input.expiresInMinutes} minutos e só pode ser usado uma vez.`,
    footer: [
      'Se não foi você que pediu, ignore esta mensagem: a sua senha atual continua valendo.',
      'Azuos Env — Azuos Dev',
    ],
  };

  return {
    to: input.to,
    subject: 'Redefinir a senha do Azuos Env',
    text: renderEmailText(content),
    html: renderEmailHtml(content),
  };
}
