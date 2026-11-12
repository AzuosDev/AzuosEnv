import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { UsersModule } from '../users/users.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleIdentityProvider } from './google/google-identity.provider';
import { GoogleLoginController } from './google/google-login.controller';
import { GOOGLE_LOGIN_PROVIDER, GoogleLoginProvider } from './google/google-login.provider';
import { GoogleLoginService } from './google/google-login.service';
import { MockGoogleLoginProvider } from './google/mock-google-login.provider';
import { RefreshTokensModule } from './refresh-tokens.module';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    RefreshTokensModule,
    UsersModule,
    ApiKeysModule,
    // The Google login accepts the invite of whoever arrives with one.
    WorkspacesModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: (config.get<string>('JWT_ACCESS_TTL') ?? '15m') as JwtSignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [AuthController, GoogleLoginController],
  providers: [
    AuthService,
    JwtStrategy,
    GoogleIdentityProvider,
    MockGoogleLoginProvider,
    {
      provide: GOOGLE_LOGIN_PROVIDER,
      inject: [ConfigService, GoogleIdentityProvider, MockGoogleLoginProvider],
      // GOOGLE_MOCK (never in production) swaps the real Google for the fake one,
      // which the e2e of the API and of the front drive.
      useFactory: (
        config: ConfigService,
        real: GoogleIdentityProvider,
        mock: MockGoogleLoginProvider,
      ): GoogleLoginProvider =>
        config.get<boolean>('GOOGLE_MOCK') === true &&
        config.get<string>('NODE_ENV') !== 'production'
          ? mock
          : real,
    },
    GoogleLoginService,
  ],
  exports: [AuthService, JwtModule, ApiKeysModule],
})
export class AuthModule {}
