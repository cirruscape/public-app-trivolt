import { describe, expect, it } from 'vitest';
import { joinLink } from './join-link.js';

describe('joinLink', () => {
  it('opens the join screen with the Join Code filled in', () => {
    expect(joinLink('https://trivolt.app', 'ABC234')).toBe('https://trivolt.app/play?code=ABC234');
  });

  it('keeps a non-default port, as in local development', () => {
    expect(joinLink('http://localhost:5173', 'XYZ789')).toBe(
      'http://localhost:5173/play?code=XYZ789',
    );
  });

  it('ignores a trailing slash on the origin', () => {
    expect(joinLink('https://trivolt.app/', 'ABC234')).toBe('https://trivolt.app/play?code=ABC234');
  });

  it('escapes the Join Code so it cannot alter the link', () => {
    expect(joinLink('https://trivolt.app', 'A&B C')).toBe('https://trivolt.app/play?code=A%26B+C');
  });
});
