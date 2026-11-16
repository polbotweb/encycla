import { randomInt } from 'node:crypto';

// No 0/O/1/I/L to keep codes readable and dictation-safe.
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;

export function generateRoomCode(
  random: (max: number) => number = (max) => randomInt(max),
): string {
  let code = '';
  for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
    code += ROOM_CODE_ALPHABET.charAt(random(ROOM_CODE_ALPHABET.length));
  }
  return code;
}

export function normalizeRoomCode(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const code = value.trim().toUpperCase();
  return ROOM_CODE_PATTERN.test(code) ? code : null;
}
