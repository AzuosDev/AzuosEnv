import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  FOLDER_CREATED,
  HierarchyCreatedEvent,
  LIST_CREATED,
  SPACE_CREATED,
} from '../hierarchy/hierarchy-events';
import { ViewsService } from './views.service';

/** Creates the default List and Board views of every new Space, Folder and List. */
@Injectable()
export class ViewsListener {
  private readonly logger = new Logger(ViewsListener.name);

  constructor(private readonly views: ViewsService) {}

  @OnEvent(SPACE_CREATED)
  @OnEvent(FOLDER_CREATED)
  @OnEvent(LIST_CREATED)
  async onCreated(event: HierarchyCreatedEvent): Promise<void> {
    try {
      await this.views.createDefaults(event);
    } catch (error) {
      this.logger.error(
        `Falha ao criar as views padrão de ${event.resourceType} ${String(event.resourceId)}.`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
