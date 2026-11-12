import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RefreshTokensService } from './refresh-tokens.service';
import { RefreshToken, RefreshTokenSchema } from './schemas/refresh-token.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: RefreshToken.name, schema: RefreshTokenSchema }])],
  providers: [RefreshTokensService],
  exports: [RefreshTokensService],
})
export class RefreshTokensModule {}
