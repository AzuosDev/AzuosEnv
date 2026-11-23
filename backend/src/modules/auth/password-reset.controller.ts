import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { SuccessDto } from '../../common/dto/api-error.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import {
  PasswordResetRequestedDto,
  PasswordResetTokenDto,
} from './dto/password-reset-response.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { PASSWORD_RESET_REQUESTED_MESSAGE, PasswordResetService } from './password-reset.service';

const FORGOT_THROTTLE = { default: { limit: 3, ttl: 15 * 60_000 } };
const RESET_THROTTLE = { default: { limit: 5, ttl: 15 * 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class PasswordResetController {
  constructor(private readonly passwordReset: PasswordResetService) {}

  @Public()
  @Throttle(FORGOT_THROTTLE)
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: 'Pedido recebido; a resposta é a mesma exista ou não a conta.',
    type: PasswordResetRequestedDto,
  })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() request: Request,
  ): Promise<{ message: string }> {
    await this.passwordReset.request(dto.email, request.ip);

    return { message: PASSWORD_RESET_REQUESTED_MESSAGE };
  }

  @Public()
  @Throttle(RESET_THROTTLE)
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: 'Senha redefinida; todas as sessões foram encerradas.',
    type: SuccessDto,
  })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ success: true }> {
    await this.passwordReset.reset(dto.token, dto.password);

    return { success: true };
  }

  @Public()
  @Get('reset-password/:token/valid')
  @ApiOkResponse({
    description: 'Diz se o link ainda pode ser usado.',
    type: PasswordResetTokenDto,
  })
  async validateToken(@Param('token') token: string): Promise<{ valid: boolean }> {
    return { valid: await this.passwordReset.isTokenValid(token) };
  }
}
