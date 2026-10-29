import { Body, Controller, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RefreshTokensService } from '../auth/refresh-tokens.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService, toAuthenticatedUser } from './users.service';
import { Types } from 'mongoose';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly refreshTokens: RefreshTokensService,
  ) {}

  @Patch('me')
  @ApiOkResponse({ description: 'Perfil atualizado.' })
  async updateMe(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<AuthenticatedUser> {
    const user = await this.usersService.updateProfile(userId, dto);

    return toAuthenticatedUser(user);
  }

  /** Changes the password and revokes every refresh token of the user. */
  @Patch('me/password')
  @ApiOkResponse({ description: 'Senha alterada; todas as sessões foram encerradas.' })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ success: true }> {
    await this.usersService.changePassword(userId, dto.currentPassword, dto.newPassword);
    await this.refreshTokens.revokeAllForUser(new Types.ObjectId(userId));

    return { success: true };
  }
}
