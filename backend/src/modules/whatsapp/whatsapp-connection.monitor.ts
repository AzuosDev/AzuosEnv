import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from '../notifications/notifications.service';
import { WhatsappProviders } from './providers/whatsapp-providers.service';
import { WaConnectionDocument } from './schemas/wa-connection.schema';
import { WhatsappAccessService } from './whatsapp-access.service';
import { WhatsappConnectionsService } from './whatsapp-connections.service';

/**
 * Vigia das conexões da Evolution. A conexão não é oficial: o celular sai do ar,
 * a sessão cai e nada avisa. A cada 5 minutos o estado da instância é conferido
 * e a primeira queda vira status "Desconectado" na Central, aviso no Inbox dos
 * gestores e evento em tempo real.
 */
@Injectable()
export class WhatsappConnectionMonitor {
  private readonly logger = new Logger(WhatsappConnectionMonitor.name);

  constructor(
    private readonly connections: WhatsappConnectionsService,
    private readonly providers: WhatsappProviders,
    private readonly access: WhatsappAccessService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async run(): Promise<void> {
    for (const connection of await this.connections.evolutionConnections()) {
      try {
        await this.check(connection);
      } catch (error) {
        this.logger.warn(
          `Não foi possível conferir a conexão ${String(connection._id)}: ${messageOf(error)}`,
        );
      }
    }
  }

  /** One connection: asks the instance and warns when it just fell. */
  private async check(connection: WaConnectionDocument): Promise<void> {
    const { credentials } = await this.connections
      .requireCredentials(connection.workspaceId)
      .catch(() => ({ credentials: null }));

    if (!credentials) {
      return;
    }

    const was = connection.status;
    const status = await this.providers.forCredentials(credentials).state(credentials);

    await this.connections.applyStatus(connection, status);

    // Só a queda avisa, e só uma vez: um número que nunca foi lido não é queda.
    if (was === 'connected' && connection.status !== 'connected') {
      await this.warn(connection);
    }
  }

  private async warn(connection: WaConnectionDocument): Promise<void> {
    const userIds = await this.access.userIdsAtLeast(connection.workspaceId, 'gestor');

    if (userIds.length === 0) {
      return;
    }

    try {
      await this.notifications.deliver({
        workspaceId: connection.workspaceId,
        type: 'whatsappConnection',
        entityType: 'workspace',
        entityId: connection.workspaceId,
        actorId: null,
        recipients: userIds.map((userId) => ({ userId, bucket: 'primary' as const })),
        data: {
          status: connection.status,
          displayPhone: connection.displayPhone,
          preview: 'O WhatsApp desconectou; leia o QR Code de novo na Central.',
        },
        mail: {
          subject: 'WhatsApp desconectado no Azuos Env',
          text: 'O número do WhatsApp desconectou. Abra a Central do WhatsApp e leia o QR Code de novo.',
        },
      });
    } catch (error) {
      this.logger.warn(`Não foi possível avisar a queda do WhatsApp: ${messageOf(error)}`);
    }
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
