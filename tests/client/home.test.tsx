// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeView } from '../../client/views/HomeView';
import { useGameStore } from '../../client/store/gameStore';

describe('HomeView', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            protocolVersion: 1,
            categories: [],
            questionCount: 244,
            categoryCount: 18,
            tiktokEnabled: false,
            subjectEnabled: false,
            limits: {},
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );
    useGameStore.getState().reset();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders the play actions with an accessible pseudo field', async () => {
    render(<HomeView />);
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
    expect(screen.getByLabelText(/pseudo/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /solo classic/i })).toBeTruthy();
  });

  it('has no critical axe violations', async () => {
    const { container } = render(<HomeView />);
    // jsdom has no layout engine, so color-contrast is verified in the browser instead.
    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
