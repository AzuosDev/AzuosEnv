import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { WhiteboardsAccessService } from './whiteboards-access.service';
import { Whiteboard, WhiteboardSchema } from './schemas/whiteboard.schema';

/**
 * Collection of the whiteboards. Separate from WhiteboardsModule so the realtime
 * gateway can check the `board` room without a circular dependency.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Whiteboard.name, schema: WhiteboardSchema }]),
    HierarchyModule,
  ],
  providers: [WhiteboardsAccessService],
  exports: [MongooseModule, WhiteboardsAccessService],
})
export class WhiteboardsDataModule {}
