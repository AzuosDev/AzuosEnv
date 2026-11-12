import { describeMailError } from './mail-error';

describe('describeMailError', () => {
  it('joins the SMTP fields that identify the failure', () => {
    const error = Object.assign(new Error('Invalid login'), {
      code: 'EAUTH',
      command: 'AUTH PLAIN',
      responseCode: 535,
      response: '535-5.7.8 Username and Password not accepted',
    });

    expect(describeMailError(error)).toBe(
      'code=EAUTH command=AUTH PLAIN responseCode=535 ' +
        'response=535-5.7.8 Username and Password not accepted message=Invalid login',
    );
  });

  it('falls back to the raw value when there is no error object', () => {
    expect(describeMailError('boom')).toBe('boom');
  });
});
