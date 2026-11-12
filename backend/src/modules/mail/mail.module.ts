import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LogMailService } from './log-mail.service';
import { MailService } from './mail.service';
import { SmtpMailService } from './smtp-mail.service';

@Module({
  providers: [
    {
      provide: MailService,
      inject: [ConfigService],
      // With SMTP_HOST the mail really goes out; without it everything stays in the log.
      useFactory: (config: ConfigService): MailService =>
        config.get<string>('SMTP_HOST') ? new SmtpMailService(config) : new LogMailService(),
    },
  ],
  exports: [MailService],
})
export class MailModule {}
