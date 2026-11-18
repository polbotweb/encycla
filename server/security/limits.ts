/**
 * Rate limits per route (D-118), per minute unless noted. Players behind one address (school,
 * office, mobile carrier NAT) share the per-IP budgets, so signed-in API calls are counted per
 * session first, with a high per-IP ceiling against floods.
 */
export const RATE_LIMITS = {
  /** `/api/*` without a valid session, per IP. */
  apiAnonymousPerIp: 120,
  /** `/api/*` with a valid session, per session (player). */
  apiPerSession: 120,
  /** `/api/*` ceiling per IP, every session included. */
  apiPerIpCeiling: 1200,
  /** `POST /api/sessions` (new anonymous player), per IP. */
  sessionCreatePerIp: 30,
  /** Admin and streamer routes (`/api/admin/*`, `POST /api/tiktok/rooms`), per IP. */
  adminPerIp: 30,
  /** `/img/*` (game pictures: 3 widths, one per round), per IP. */
  imagesPerIp: 1200,
  /** Socket `ROOM_JOIN` (code guessing), per player and per IP. */
  roomJoinPerPlayer: 10,
  roomJoinPerIp: 60,
  /** Socket.io connections (handshakes), per IP. */
  socketConnectsPerIp: 120,
  /** Other socket events, per connection: sustained rate per second and burst. */
  socketEventsPerSecond: 10,
  socketEventsBurst: 20,
} as const;
