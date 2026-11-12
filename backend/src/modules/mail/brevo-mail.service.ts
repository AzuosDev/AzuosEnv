import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describeMailError } from './mail-error';
import { MailMessage, MailService } from './mail.service';
import { renderNoticeHtml } from './templates/notice-email';

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';
const REQUEST_TIMEOUT_MS = 10_000;

export interface MailSender {
  name?: string;
  email: string;
}

/** Aceita "Nome <conta@dominio>" ou só o endereço. */
export function parseSender(value: string): MailSender {
  const match = /^\s*(.*?)\s*<\s*([^<>\s]+)\s*>\s*$/.exec(value);

  if (!match) {
    return { email: value.trim() };
  }

  const name = match[1].replace(/^"|"$/g, '').trim();

  return name.length > 0 ? { name, email: match[2] } : { email: match[2] };
}

/**
 * Envia pela API HTTP da Brevo.
 *
 * Em serverless o SMTP e o pior caminho: porta que pode estar bloqueada,
 * handshake longo e, no caso do Gmail, cota diaria de conta pessoal. A API e
 * uma requisicao HTTPS comum, com erro legivel no corpo da resposta.
 */
@Injectable()
export class BrevoMailService extends MailService {
  private readonly logger = new Logger(BrevoMailService.name);
  private readonly apiKey: string;
  private readonly sender: MailSender;

  constructor(config: ConfigService) {
    super();

    this.apiKey = config.getOrThrow<string>('BREVO_API_KEY');
    this.sender = parseSender(
      config.get<string>('MAIL_FROM') ||
        config.get<string>('SMTP_FROM') ||
        'Azuos Env <no-reply@azuos.dev>',
    );
  }

  async send(message: MailMessage): Promise<void> {
    try {
      const response = await fetch(BREVO_ENDPOINT, {
        method: 'POST',
        headers: {
          'api-key': this.apiKey,
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: this.sender,
          to: [{ email: message.to }],
          subject: message.subject,
          textContent: message.text,
          htmlContent: message.html ?? renderNoticeHtml(message.subject, message.text),
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        // O corpo traz { code, message } — e o que diz se a chave, o remetente
        // ou a cota e que estao errados.
        throw new Error(`Brevo respondeu ${String(response.status)}: ${await response.text()}`);
      }
    } catch (error) {
      this.logger.error(`[mail] falhou para ${message.to}: ${describeMailError(error)}`);

      throw error;
    }

    this.logger.log(`[mail] enviado para ${message.to}: ${message.subject}`);
  }
}
