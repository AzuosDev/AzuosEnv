import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  timezone: string;
  locale: string;
  theme: string;
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

/** Injects the authenticated user (or one of its properties) into a handler. */
export const CurrentUser = createParamDecorator(
  (property: keyof AuthenticatedUser | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user) {
      return undefined;
    }

    return property ? user[property] : user;
  },
);
