import { initialize, type ActivationContext } from '@ableton-extensions/sdk';
import { Storage } from './storage.js';
import { startServer } from './server.js';

/**
 * Modal dialog dimensions (width × height in pixels).
 * The SDK `showModalDialog` API only accepts fixed pixel sizes — no percentage
 * width or user-resizable chrome. 600px width is the target for ~40% on typical displays.
 */
const DIALOG_WIDTH = 600;
const DIALOG_HEIGHT = 820;

export const activate = (activation: ActivationContext): void => {
  const context = initialize(activation, '1.0.0');

  console.log('[Live Agent] Extension activated');

  void (async () => {
    const storageDir = context.environment.storageDirectory ?? '.';
    const storage = new Storage(storageDir);

    const server = await startServer(
      () => context.application.song,
      storage,
      (cb) => context.withinTransaction(cb),
    );

    // Register the "Open Live Agent" command
    context.commands.registerCommand('live-agent.open', () => {
      console.log(`[Live Agent] Opening dialog ${DIALOG_WIDTH}×${DIALOG_HEIGHT}`);
      context.ui
        .showModalDialog(`http://127.0.0.1:${server.port}/`, DIALOG_WIDTH, DIALOG_HEIGHT)
        .catch((err: unknown) => {
          console.error('[Live Agent] Dialog error:', err);
        });
    });

    // Register context menu actions across all relevant scopes
    const scopes = [
      'MidiTrack',
      'AudioTrack',
      'Scene',
      'MidiClip',
      'AudioClip',
      'ClipSlot',
    ] as const;

    for (const scope of scopes) {
      context.ui
        .registerContextMenuAction(scope, 'Open Live Agent', 'live-agent.open')
        .then(() => console.log(`[Live Agent] Context menu registered for ${scope}`))
        .catch((err: unknown) => console.error(`[Live Agent] Failed to register ${scope}:`, err));
    }

    console.log(`[Live Agent] Ready — ${context.application.song.tracks.length} tracks loaded`);
  })();
};
