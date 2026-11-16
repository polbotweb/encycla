export type AppRoute =
  | { kind: 'player'; screen: 'home' | 'leaderboard'; code: string }
  | { kind: 'overlay'; roomCode: string; token: string }
  | { kind: 'control'; roomCode: string; token: string; overlayToken: string | undefined };

/**
 * `/?mode=overlay&room=CODE#token=...` — the token lives in the fragment so it never reaches
 * the HTTP server or its logs (D-76).
 */
export function parseRoute(search: string, hash: string): AppRoute {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ''));
  const mode = query.get('mode');
  const room = (query.get('room') ?? '').toUpperCase();
  const token = fragment.get('token') ?? '';

  if (mode === 'overlay') {
    return { kind: 'overlay', roomCode: room, token };
  }
  if (mode === 'control') {
    return {
      kind: 'control',
      roomCode: room,
      token,
      overlayToken: fragment.get('overlay') ?? undefined,
    };
  }
  if (mode === 'leaderboard') {
    return { kind: 'player', screen: 'leaderboard', code: '' };
  }
  if (mode === 'join') {
    const code = (query.get('code') ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    return { kind: 'player', screen: 'home', code };
  }
  return { kind: 'player', screen: 'home', code: '' };
}
