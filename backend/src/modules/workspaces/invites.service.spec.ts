import { Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { InvitesService } from './invites.service';
import { AssignableRole } from './workspace-roles';

const execOf = <T>(value: T) => ({ exec: () => Promise.resolve(value) });

/** Monta o serviço com o mínimo de dependências reais para exercitar create(). */
function buildService(sendMail: jest.Mock) {
  const invite = { _id: new Types.ObjectId(), email: 'colega@azuos.dev' };
  const model = {
    deleteMany: jest.fn(() => execOf({ deletedCount: 0 })),
    create: jest.fn(() => Promise.resolve(invite)),
  };
  const members = { findOne: jest.fn(() => execOf(null)), updateOne: jest.fn(() => execOf({})) };
  const usersService = { findByEmail: jest.fn(() => Promise.resolve(null)), namesByIds: jest.fn() };
  const events = { emit: jest.fn() };
  const config = { get: jest.fn(() => 'https://app.azuos.dev') };

  const service = new InvitesService(
    model as never,
    members as never,
    {} as never,
    usersService as never,
    { send: sendMail } as never,
    config as never,
    events as never,
  );

  return { service, model, events };
}

describe('InvitesService.create', () => {
  const workspace = { _id: new Types.ObjectId(), name: 'Azuos Dev' };
  const actor = { userId: new Types.ObjectId().toHexString() };
  const dto = { email: 'colega@azuos.dev', role: 'member' as AssignableRole };

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports emailSent when the message goes out', async () => {
    const { service } = buildService(jest.fn(() => Promise.resolve()));

    const created = await service.create(workspace as never, actor as never, dto);

    expect(created.emailSent).toBe(true);
    expect(created.acceptUrl).toContain(created.token);
  });

  it('keeps the invite when SMTP fails instead of failing the request', async () => {
    const smtpError = Object.assign(new Error('Invalid login'), { responseCode: 535 });
    const { service, model } = buildService(jest.fn(() => Promise.reject(smtpError)));

    const created = await service.create(workspace as never, actor as never, dto);

    expect(created.emailSent).toBe(false);
    expect(model.create).toHaveBeenCalled();
    expect(created.acceptUrl).toContain(created.token);
  });
});
