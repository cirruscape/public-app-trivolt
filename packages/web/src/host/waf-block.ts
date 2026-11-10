// The user pool's WAF web ACL (infra/foundation.yaml) blocks Host sign-up and sign-in from
// outside New Zealand and from suspicious networks. Cognito reports a block as a
// ForbiddenException, which the Authenticator would show as Cognito's terse message, so the
// Authenticator's Cognito calls are wrapped to say what happened and how to get access.

export const WAF_BLOCK_MESSAGE =
  "Unauthorised: Host sign-up and sign-in aren't available from your location or network. " +
  'To request access, email support@cirruscape.com.';

export function isWafBlock(err: unknown): boolean {
  return err instanceof Error && err.name === 'ForbiddenException';
}

// Returns the same type as `fn`, so overloaded Amplify functions (signIn and others) keep
// their overloads and still fit the Authenticator's `services` prop.
export function withWafBlockMessage<F extends (...args: never[]) => Promise<unknown>>(fn: F): F {
  const wrapped = async (...args: Parameters<F>) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (isWafBlock(err)) throw new Error(WAF_BLOCK_MESSAGE, { cause: err });
      throw err;
    }
  };
  return wrapped as unknown as F;
}
