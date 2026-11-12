import { escapeHtml } from './email-layout';
import { buildInviteEmail } from './invite-email';
import { renderNoticeHtml } from './notice-email';

const base = {
  to: 'pessoa@azuos.dev',
  workspaceName: 'Azuos Dev',
  roleLabel: 'Membro',
  acceptUrl: 'https://env.azuos.dev/convite/abc123',
  expiresInDays: 7,
};

describe('buildInviteEmail', () => {
  it('monta assunto, texto e HTML com o link de aceite', () => {
    const message = buildInviteEmail({ ...base, inviterName: 'Felipe' });

    expect(message.subject).toBe('Convite para o workspace Azuos Dev');
    expect(message.text).toContain('Felipe convidou você');
    expect(message.text).toContain(base.acceptUrl);
    expect(message.html).toContain('Entre no workspace Azuos Dev');
    expect(message.html).toContain(escapeHtml(base.acceptUrl));
    expect(message.html).toContain('expira em 7 dias');
  });

  it('dispensa o nome de quem convidou quando ele não é conhecido', () => {
    const message = buildInviteEmail(base);

    expect(message.text).toContain('Você foi convidado para colaborar');
    expect(message.text).not.toContain('undefined');
  });

  it('escapa conteúdo vindo do workspace', () => {
    const message = buildInviteEmail({ ...base, workspaceName: '<script>x</script>' });

    expect(message.html).not.toContain('<script>');
    expect(message.html).toContain('&lt;script&gt;');
  });

  it('usa o mesmo invólucro para mensagens simples', () => {
    const html = renderNoticeHtml('Lembrete', 'ENV-12 — Revisar proposta');

    expect(html).toContain('Lembrete');
    expect(html).toContain('ENV-12 — Revisar proposta');
    expect(html).toContain('#0b0714');
  });
});
