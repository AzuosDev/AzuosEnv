import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RecentsService } from './recents.service';
import { Favorite, FavoriteSchema } from './schemas/favorite.schema';
import { RecentItem, RecentItemSchema } from './schemas/recent-item.schema';

/**
 * Collections of the favorites module. Separate from FavoritesModule so the tasks
 * and hierarchy modules can record an open without a circular dependency.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Favorite.name, schema: FavoriteSchema },
      { name: RecentItem.name, schema: RecentItemSchema },
    ]),
  ],
  providers: [RecentsService],
  exports: [MongooseModule, RecentsService],
})
export class FavoritesDataModule {}
