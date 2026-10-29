import { Module } from '@nestjs/common';
import { LogMailService } from './log-mail.service';
import { MailService } from './mail.service';

@Module({
  providers: [{ provide: MailService, useClass: LogMailService }],
  exports: [MailService],
})
export class MailModule {}
