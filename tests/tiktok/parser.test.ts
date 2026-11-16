import { describe, expect, it } from 'vitest';
import { parseAnswerComment } from '../../server/tiktok/parser';
import { viewerPseudo } from '../../server/tiktok/service';

describe('parseAnswerComment', () => {
  it.each([
    ['A', 0],
    ['a.', 0],
    ['@user B', 1],
    ['@one @two c', 2],
    ['C !', 2],
    ['  d  ', 3],
    ['Ｂ', 1],
    ['🔥 A 🔥', 0],
    ['(b)', 1],
  ])('accepts %j', (comment, expected) => {
    expect(parseAnswerComment(comment)).toBe(expected);
  });

  it.each([
    'réponse A',
    'AB',
    'A ou B',
    'https://example.com A',
    'www.example.com b',
    'bonjour',
    'E',
    '',
    '   ',
    '@user',
    '1',
    'a'.repeat(501),
  ])('rejects %j', (comment) => {
    expect(parseAnswerComment(comment)).toBeNull();
  });

  it('rejects non-string input', () => {
    expect(parseAnswerComment(undefined)).toBeNull();
    expect(parseAnswerComment(42)).toBeNull();
  });
});

describe('viewerPseudo', () => {
  it('prefers a clean nickname and falls back to the handle', () => {
    expect(viewerPseudo('Élodie ✨', 'elodie_99')).toBe('Élodie');
    expect(viewerPseudo('✨', 'elodie_99')).toBe('elodie_99');
    expect(viewerPseudo(null, '_')).toBe('Viewer');
    expect(viewerPseudo('<script>x</script>', 'u')).toBe('scriptxscript');
    expect([...viewerPseudo('x'.repeat(40), 'u')]).toHaveLength(24);
  });
});
