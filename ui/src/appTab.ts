/** Active application panel in the Live Agent webview. */
export type AppTab = 'chat' | 'settings';

/** Lucide icon name used for the panel toggle button. */
export type PanelToggleIcon = 'settings' | 'message-square';

/** Label and icon for switching away from the current panel. */
export interface PanelToggleMeta {
  target: AppTab;
  icon: PanelToggleIcon;
  title: string;
}

/**
 * Returns the tab to switch to when the user clicks the panel toggle control.
 */
export function toggleAppTab(tab: AppTab): AppTab {
  return tab === 'chat' ? 'settings' : 'chat';
}

/**
 * Describes the panel-toggle button for the current tab (icon shows the destination).
 */
export function getPanelToggleMeta(tab: AppTab): PanelToggleMeta {
  if (tab === 'chat') {
    return { target: 'settings', icon: 'settings', title: 'Settings' };
  }
  return { target: 'chat', icon: 'message-square', title: 'Chat' };
}
