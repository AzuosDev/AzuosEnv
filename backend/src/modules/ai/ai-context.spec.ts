import { REDACTED, contextText, redactSecrets, redactValue, truncate } from './ai-context';

describe('redactSecrets', () => {
  it('remove o valor de chaves que parecem segredo', () => {
    expect(redactSecrets('senha: Azuos2026')).toBe(`senha: ${REDACTED}`);
    expect(redactSecrets('DB_PASSWORD=super-secreto')).toBe(`DB_PASSWORD=${REDACTED}`);
    expect(redactSecrets('{"apiKey": "abc123def456"}')).toContain(REDACTED);
    expect(redactSecrets('{"apiKey": "abc123def456"}')).not.toContain('abc123def456');
  });

  it('remove credenciais pelo formato', () => {
    expect(redactSecrets('Authorization: Bearer abcdef123456')).not.toContain('abcdef123456');
    expect(redactSecrets('use xai-01234567890123456789 agora')).toBe(`use ${REDACTED} agora`);
    expect(redactSecrets(`token ${'a'.repeat(40)}`)).toBe(`token ${REDACTED}`);
  });

  it('não mexe em texto comum', () => {
    const text = 'Corrigir o fechamento de caixa do PDV da Cênio até sexta.';

    expect(redactSecrets(text)).toBe(text);
  });
});

describe('redactValue', () => {
  it('apaga o valor inteiro de uma chave sensível', () => {
    expect(
      redactValue({ name: 'Tarefa', passwordHash: 'argon2id$abc', nested: { token: 'xyz' } }),
    ).toEqual({ name: 'Tarefa', passwordHash: REDACTED, nested: { token: REDACTED } });
  });

  it('percorre listas e preserva o resto', () => {
    expect(redactValue([{ senha: '123' }, 'ok', 7])).toEqual([{ senha: REDACTED }, 'ok', 7]);
  });
});

describe('truncate', () => {
  it('marca o corte', () => {
    expect(truncate('abcdef', 3)).toBe('abc […]');
    expect(truncate('  abc  ', 10)).toBe('abc');
  });

  it('contextText redige antes de cortar', () => {
    expect(contextText('senha: 123456789', 100)).toBe(`senha: ${REDACTED}`);
  });
});
