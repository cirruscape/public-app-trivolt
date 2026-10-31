// The Join Link: opens the join screen with a Game's Join Code already filled in (see JoinPage).
export function joinLink(origin: string, joinCode: string): string {
  const url = new URL('/play', origin);
  url.searchParams.set('code', joinCode);
  return url.href;
}
