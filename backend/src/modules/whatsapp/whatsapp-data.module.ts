import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  WorkspaceMember,
  WorkspaceMemberSchema,
} from '../workspaces/schemas/workspace-member.schema';
import { WaAccess, WaAccessSchema } from './schemas/wa-access.schema';
import { WaConnection, WaConnectionSchema } from './schemas/wa-connection.schema';
import { WaContact, WaContactSchema } from './schemas/wa-contact.schema';
import { WaConversation, WaConversationSchema } from './schemas/wa-conversation.schema';
import { WaMessage, WaMessageSchema } from './schemas/wa-message.schema';
import { WhatsappAccessService } from './whatsapp-access.service';

/**
 * Collections of the whatsapp module. Separate from WhatsappModule so the realtime
 * gateway can check the access of a room without a circular dependency.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WaAccess.name, schema: WaAccessSchema },
      { name: WaConnection.name, schema: WaConnectionSchema },
      { name: WaContact.name, schema: WaContactSchema },
      { name: WaConversation.name, schema: WaConversationSchema },
      { name: WaMessage.name, schema: WaMessageSchema },
      { name: WorkspaceMember.name, schema: WorkspaceMemberSchema },
    ]),
  ],
  providers: [WhatsappAccessService],
  exports: [MongooseModule, WhatsappAccessService],
})
export class WhatsappDataModule {}
