import { escapeHtml } from './email-layout';
import { buildPasswordResetEmail } from './password-reset-email';

const base = {
  to: 'pessoa@azuos.dev',
  resetUrl: 'https://env.azuos.dev/redefinir-senha/abc123',
  expiresInMinutes: 30,
};

describe('buildPasswordResetEmail', () => {
  it('monta assunto, texto e HTML com o link de redefinição', () => {
    const message = buildPasswordResetEmail({ ...base, name: 'Felipe' });

    expect(message.subject).toBe('Redefinir a senha do Azuos Env');
    expect(message.text).toContain('Felipe, recebemos um pedido');
    expect(message.text).toContain(base.resetUrl);
    expect(message.html).toContain('Redefinir sua senha');
    expect(message.html).toContain(escapeHtml(base.resetUrl));
    expect(message.html).toContain('expira em 30 minutos');
  });

  it('dispensa o nome quando ele não é conhecido', () => {
    const message = buildPasswordResetEmail(base);

    expect(message.text).toContain('Recebemos um pedido');
    expect(message.text).not.toContain('undefined');
  });
});
