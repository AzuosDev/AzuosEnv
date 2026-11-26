import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { WebPushError } from 'web-push';
import { PushService } from './push.service';
import { PushSubscription, PushSubscriptionDocument } from './schemas/push-subscription.schema';

const sendNotification = jest.fn();

// O web-push é ESM e o envio é rede: o módulo inteiro é dublê. O WebPushError
// do dublê é o mesmo que o serviço importa, então o `instanceof` dele vale.
jest.mock('web-push', () => {
  class FakeWebPushError extends Error {
    constructor(
      message: string,
      readonly statusCode: number,
    ) {
      super(message);
      this.name = 'WebPushError';
    }
  }

  return {
    WebPushError: FakeWebPushError,
    setVapidDetails: jest.fn(),
    sendNotification: (...args: unknown[]) => sendNotification(...args),
  };
});

/** Chave VAPID de teste (par gerado só para este spec). */
const PUBLIC_KEY =
  'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkFbx4gpXDfQnX2k_7OnmKhLSAgBzJ_0C2wDTKwKPXnBnJ7hJ4FhEyM';
const PRIVATE_KEY = 'aUAIbOKVBJt-2MBVWs8RcRS2wDGR9eWAXRK1-NnCAWw';

function pushError(statusCode: number): WebPushError {
  return new WebPushError('recusado', statusCode, {}, '', '');
}

function subscription(id: string): PushSubscriptionDocument {
  return {
    _id: new Types.ObjectId(),
    userId: new Types.ObjectId(),
    endpoint: `https://fcm.googleapis.com/fcm/send/${id}`,
    p256dh: 'chave-do-navegador',
    auth: 'segredo-do-navegador',
    userAgent: 'Edge no Windows',
  } as unknown as PushSubscriptionDocument;
}

/** Model de teste: guarda as inscrições em memória e registra as remoções. */
function fakeModel(docs: PushSubscriptionDocument[]) {
  const deleted: string[] = [];

  return {
    deleted,
    model: {
      find: () => ({ exec: async () => docs }),
      deleteOne: (filter: { _id: Types.ObjectId }) => ({
        exec: async () => {
          deleted.push(String(filter._id));
        },
      }),
    },
  };
}

function service(docs: PushSubscriptionDocument[], configured = true) {
  const { model, deleted } = fakeModel(docs);
  const config = {
    get: (key: string) =>
      !configured
        ? ''
        : key === 'VAPID_PUBLIC_KEY'
          ? PUBLIC_KEY
          : key === 'VAPID_PRIVATE_KEY'
            ? PRIVATE_KEY
            : 'mailto:no-reply@azuos.dev',
  } as unknown as ConfigService;

  return {
    push: new PushService(model as unknown as ConstructorParameters<typeof PushService>[0], config),
    deleted,
  };
}

describe('PushService', () => {
  beforeEach(() => {
    sendNotification.mockReset();
  });

  it('sem chaves VAPID o canal fica desligado e não envia', async () => {
    const { push } = service([subscription('sem-chave')], false);

    expect(push.publicKey).toBe('');
    expect(await push.sendTest(new Types.ObjectId())).toEqual([]);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('o teste devolve o host de cada dispositivo que aceitou o aviso', async () => {
    const { push, deleted } = service([subscription('ok')]);

    sendNotification.mockResolvedValue({ statusCode: 201 });

    const [result] = await push.sendTest(new Types.ObjectId());

    expect(result).toEqual({ host: 'fcm.googleapis.com', ok: true, statusCode: 201, message: '' });
    expect(deleted).toEqual([]);
  });

  it('inscrição que o navegador descartou (410) sai do banco', async () => {
    const doc = subscription('expirada');
    const { push, deleted } = service([doc]);

    sendNotification.mockRejectedValue(pushError(410));

    const [result] = await push.sendTest(new Types.ObjectId());

    expect(result.ok).toBe(false);
    expect(result.statusCode).toBe(410);
    expect(deleted).toEqual([String(doc._id)]);
  });

  it.each([401, 403])(
    'inscrição feita com outra chave VAPID (%i) sai do banco para o navegador se inscrever de novo',
    async (status) => {
      const doc = subscription('chave-velha');
      const { push, deleted } = service([doc]);

      sendNotification.mockRejectedValue(pushError(status));

      const [result] = await push.sendTest(new Types.ObjectId());

      expect(result.ok).toBe(false);
      expect(result.statusCode).toBe(status);
      expect(result.message).toContain('recusou a chave do servidor');
      expect(deleted).toEqual([String(doc._id)]);
    },
  );

  it('falha passageira do serviço de push não apaga a inscrição', async () => {
    const doc = subscription('instavel');
    const { push, deleted } = service([doc]);

    sendNotification.mockRejectedValue(pushError(500));

    const [result] = await push.sendTest(new Types.ObjectId());

    expect(result).toMatchObject({ ok: false, statusCode: 500 });
    expect(deleted).toEqual([]);
  });

  it('envio em massa nunca lança, mesmo com o serviço de push fora', async () => {
    const { push } = service([subscription('um'), subscription('dois')]);

    sendNotification.mockRejectedValue(new Error('rede caiu'));

    await expect(
      push.sendToUsers([new Types.ObjectId()], { title: 'a', body: 'b', url: '/' }),
    ).resolves.toBeUndefined();
    expect(sendNotification).toHaveBeenCalledTimes(2);
  });
});

/** O schema entra no spec só para o nome da coleção não sair do lugar. */
expect(PushSubscription.name).toBe('PushSubscription');
