import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrevoMailService } from './brevo-mail.service';
import { LogMailService } from './log-mail.service';
import { MailService } from './mail.service';
import { SmtpMailService } from './smtp-mail.service';

/**
 * Ordem: BREVO_API_KEY (API HTTP, o caminho de producao em serverless),
 * depois SMTP_HOST (servidor proprio) e, sem nenhum dos dois, só o log.
 *
 * NODE_ENV=test nunca sai do log: a suíte cria dezenas de convites para
 * `user-<uuid>@azuos.dev`, um domínio que não existe. Com transporte real isso
 * vira centenas de mensagens recusadas, queima a cota do provedor e enche a
 * caixa do remetente de devoluções — já aconteceu uma vez.
 */
export function createMailService(config: ConfigService): MailService {
  if (config.get<string>('NODE_ENV') === 'test') {
    return new LogMailService();
  }

  if (config.get<string>('BREVO_API_KEY')) {
    return new BrevoMailService(config);
  }

  return config.get<string>('SMTP_HOST') ? new SmtpMailService(config) : new LogMailService();
}

@Module({
  providers: [
    {
      provide: MailService,
      inject: [ConfigService],
      useFactory: createMailService,
    },
  ],
  exports: [MailService],
})
export class MailModule {}
