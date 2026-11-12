import { Body, Controller, Delete, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RefreshTokensService } from '../auth/refresh-tokens.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SuccessDto } from '../../common/dto/api-error.dto';
import { AuthUserDto } from '../auth/dto/auth-response.dto';
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
  @ApiOkResponse({ description: 'Perfil atualizado.', type: AuthUserDto })
  async updateMe(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<AuthenticatedUser> {
    const user = await this.usersService.updateProfile(userId, dto);

    return toAuthenticatedUser(user);
  }

  /** First password of an account created with Google; the sessions stay open. */
  @Post('me/password/set')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Senha definida.', type: SuccessDto })
  async setPassword(
    @CurrentUser('id') userId: string,
    @Body() dto: SetPasswordDto,
  ): Promise<{ success: true }> {
    await this.usersService.setPassword(userId, dto.password);

    return { success: true };
  }

  /** Unlinks Google; refused while the account has no password. */
  @Delete('me/google')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Conta do Google desvinculada.', type: SuccessDto })
  async unlinkGoogle(@CurrentUser('id') userId: string): Promise<{ success: true }> {
    await this.usersService.unlinkGoogle(userId);

    return { success: true };
  }

  /** Changes the password and revokes every refresh token of the user. */
  @Patch('me/password')
  @ApiOkResponse({
    description: 'Senha alterada; todas as sessões foram encerradas.',
    type: SuccessDto,
  })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ success: true }> {
    await this.usersService.changePassword(userId, dto.currentPassword, dto.newPassword);
    await this.refreshTokens.revokeAllForUser(new Types.ObjectId(userId));

    return { success: true };
  }
}
