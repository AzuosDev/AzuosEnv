import { brazilNumberVariants, isIgnorableJid, jidFromWaId, waIdFromJid } from './whatsapp-jid';

describe('whatsapp-jid', () => {
  it('ignora grupo, status e difusão', () => {
    expect(isIgnorableJid('120363000000000000@g.us')).toBe(true);
    expect(isIgnorableJid('status@broadcast')).toBe(true);
    expect(isIgnorableJid('')).toBe(true);
    expect(isIgnorableJid('5531999990000@s.whatsapp.net')).toBe(false);
  });

  it('tira o número do JID, com ou sem o sufixo do aparelho', () => {
    expect(waIdFromJid('5531999990000@s.whatsapp.net')).toBe('5531999990000');
    expect(waIdFromJid('5531999990000:12@s.whatsapp.net')).toBe('5531999990000');
    expect(waIdFromJid('')).toBe('');
    expect(jidFromWaId('5531999990000')).toBe('5531999990000@s.whatsapp.net');
  });

  it('oferece as duas formas de um celular brasileiro, a digitada primeiro', () => {
    expect(brazilNumberVariants('5531999990000')).toEqual(['5531999990000', '553199990000']);
    expect(brazilNumberVariants('553199990000')).toEqual(['553199990000', '5531999990000']);
  });

  it('trata oito dígitos de celular, mas não fixo nem número de fora', () => {
    expect(brazilNumberVariants('553188880000')).toEqual(['553188880000', '5531988880000']);
    expect(brazilNumberVariants('553133330000')).toEqual(['553133330000']);
    expect(brazilNumberVariants('5531388880000')).toEqual(['5531388880000']);
    expect(brazilNumberVariants('12025550123')).toEqual(['12025550123']);
  });
});
