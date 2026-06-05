import { describe, it, expect } from 'vitest';
import { messageTopMargin } from './messageSpacing.js';
import type { ChatMessage } from './types.js';

const msg = (role: ChatMessage['role'], id: string): ChatMessage => ({
  id,
  role,
  content: '',
});

describe('messageTopMargin', () => {
  it('returns empty for the first message', () => {
    expect(messageTopMargin(0, [msg('user', '1')])).toBe('');
  });

  it('adds extra margin between user and agent', () => {
    const messages = [msg('user', '1'), msg('agent', '2')];
    expect(messageTopMargin(1, messages)).toBe('mt-5');
  });

  it('adds extra margin between agent and user', () => {
    const messages = [msg('agent', '1'), msg('user', '2')];
    expect(messageTopMargin(1, messages)).toBe('mt-5');
  });

  it('uses default margin for same-role consecutive messages', () => {
    const messages = [msg('tool', '1'), msg('tool', '2')];
    expect(messageTopMargin(1, messages)).toBe('mt-3');
  });
});
