// The Host's first name at sign-up. Cognito's standard given_name attribute stays optional in
// the user pool (making it required there would mean replacing the pool, and Hosts who signed
// up earlier don't have it), but the sign-up form requires it of every new Host.
import type { SignUpInput } from 'aws-amplify/auth';

/** Long enough for any real first name; Cognito itself allows 2048 characters. */
export const GIVEN_NAME_MAX = 50;

type FormData = Record<string, unknown>;
type TouchData = Record<string, boolean>;

/** Rejects a blank or over-long first name, once the Host has touched the field. */
export function validateGivenName(
  formData: FormData,
  touchData: TouchData = {},
): Record<string, string> | null {
  if (!touchData.given_name) return null;
  const name = typeof formData.given_name === 'string' ? formData.given_name.trim() : '';
  if (!name) return { given_name: 'Enter your first name.' };
  if (name.length > GIVEN_NAME_MAX) {
    return { given_name: `Use ${GIVEN_NAME_MAX} characters or fewer.` };
  }
  return null;
}

/** Saves the first name without stray spaces. */
export function trimGivenName(input: SignUpInput): SignUpInput {
  const attributes = input.options?.userAttributes;
  if (typeof attributes?.given_name !== 'string') return input;
  return {
    ...input,
    options: {
      ...input.options,
      userAttributes: { ...attributes, given_name: attributes.given_name.trim() },
    },
  };
}
