import { describe, expect, it } from 'vitest';
import { WAF_BLOCK_MESSAGE, isWafBlock, withWafBlockMessage } from './waf-block.js';

function cognitoError(name: string, message = 'from Cognito'): Error {
  const err = new Error(message);
  err.name = name;
  return err;
}

describe('isWafBlock', () => {
  it('is true for the ForbiddenException Cognito returns when WAF blocks a request', () => {
    expect(isWafBlock(cognitoError('ForbiddenException'))).toBe(true);
  });

  it('is false for other Cognito errors', () => {
    expect(isWafBlock(cognitoError('NotAuthorizedException'))).toBe(false);
    expect(isWafBlock(cognitoError('UsernameExistsException'))).toBe(false);
  });

  it('is false for non-errors', () => {
    expect(isWafBlock('ForbiddenException')).toBe(false);
    expect(isWafBlock(undefined)).toBe(false);
  });
});

describe('withWafBlockMessage', () => {
  it('replaces a WAF block with the request-access message', async () => {
    const blocked = withWafBlockMessage(async () => {
      throw cognitoError('ForbiddenException', 'Request not allowed due to WAF block.');
    });
    await expect(blocked()).rejects.toThrow(WAF_BLOCK_MESSAGE);
  });

  it('rethrows other errors unchanged', async () => {
    const original = cognitoError('NotAuthorizedException', 'Incorrect username or password.');
    const failing = withWafBlockMessage(async () => {
      throw original;
    });
    await expect(failing()).rejects.toBe(original);
  });

  it('passes arguments through and returns the result', async () => {
    const add = withWafBlockMessage(async (a: number, b: number) => a + b);
    await expect(add(2, 3)).resolves.toBe(5);
  });
});

it('tells the Host how to request access', () => {
  expect(WAF_BLOCK_MESSAGE).toMatch(/^Unauthorised/);
  expect(WAF_BLOCK_MESSAGE).toContain('support@cirruscape.com');
});
