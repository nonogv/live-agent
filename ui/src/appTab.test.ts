import { describe, it, expect } from 'vitest';
import { getPanelToggleMeta, toggleAppTab } from './appTab.js';

describe('toggleAppTab', () => {
  it('switches from chat to settings', () => {
    expect(toggleAppTab('chat')).toBe('settings');
  });

  it('switches from settings to chat', () => {
    expect(toggleAppTab('settings')).toBe('chat');
  });
});

describe('getPanelToggleMeta', () => {
  it('offers settings when on chat', () => {
    expect(getPanelToggleMeta('chat')).toEqual({
      target: 'settings',
      icon: 'settings',
      title: 'Settings',
    });
  });

  it('offers chat when on settings', () => {
    expect(getPanelToggleMeta('settings')).toEqual({
      target: 'chat',
      icon: 'message-square',
      title: 'Chat',
    });
  });
});
