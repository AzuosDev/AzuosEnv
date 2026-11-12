import { Types } from 'mongoose';
import { extractMentions } from './mentions';

describe('extractMentions', () => {
  const first = new Types.ObjectId().toHexString();
  const second = new Types.ObjectId().toHexString();

  it('reads the mention nodes of the editor JSON', () => {
    const body = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Olá ' },
            { type: 'mention', attrs: { id: first, label: 'Felipe' } },
            { type: 'text', text: ' e ' },
            { type: 'mention', attrs: { id: second, label: 'Ana' } },
          ],
        },
      ],
    };

    expect(extractMentions(body).map(String)).toEqual([first, second]);
  });

  it('ignores repeated, invalid and absent ids', () => {
    const body = {
      content: [
        { type: 'mention', attrs: { id: first } },
        { type: 'mention', attrs: { id: first } },
        { type: 'mention', attrs: { id: 'nao-e-objectid' } },
        { type: 'mention' },
        { type: 'text', text: '@ninguem' },
      ],
    };

    expect(extractMentions(body).map(String)).toEqual([first]);
  });

  it('returns nothing for an empty body', () => {
    expect(extractMentions(null)).toEqual([]);
    expect(extractMentions(undefined)).toEqual([]);
  });
});
