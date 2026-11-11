import { describe, expect, it } from 'vitest';
import { GIVEN_NAME_MAX, trimGivenName, validateGivenName } from './sign-up.js';

describe('validateGivenName', () => {
  it('accepts a first name', () => {
    expect(validateGivenName({ given_name: 'Bryce' }, { given_name: true })).toBeNull();
  });

  it('rejects a name that is only spaces, once the field has been touched', () => {
    expect(validateGivenName({ given_name: '   ' }, { given_name: true })).toEqual({
      given_name: 'Enter your first name.',
    });
  });

  it("doesn't complain before the field has been touched", () => {
    expect(validateGivenName({ given_name: '' }, {})).toBeNull();
  });

  it('rejects a name that is too long', () => {
    expect(
      validateGivenName({ given_name: 'x'.repeat(GIVEN_NAME_MAX + 1) }, { given_name: true }),
    ).toEqual({ given_name: `Use ${GIVEN_NAME_MAX} characters or fewer.` });
    expect(
      validateGivenName({ given_name: 'x'.repeat(GIVEN_NAME_MAX) }, { given_name: true }),
    ).toBeNull();
  });
});

describe('trimGivenName', () => {
  it('trims the first name, leaving everything else as it is', () => {
    const input = {
      username: 'host@example.com',
      password: 'secret',
      options: { userAttributes: { email: 'host@example.com', given_name: '  Bryce ' } },
    };
    expect(trimGivenName(input)).toEqual({
      ...input,
      options: { userAttributes: { email: 'host@example.com', given_name: 'Bryce' } },
    });
  });

  it('leaves a sign-up without a first name alone', () => {
    const input = { username: 'host@example.com', password: 'secret' };
    expect(trimGivenName(input)).toEqual(input);
  });
});
