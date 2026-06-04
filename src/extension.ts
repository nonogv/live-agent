import { initialize, type ActivationContext } from '@ableton-extensions/sdk';
import { Storage } from './storage.js';
import { startServer } from './server.js';

export const activate = (activation: ActivationContext): void => {
  const context = initialize(activation, '1.0.0');

  console.log('[Live Agent] Extension activated');

  void (async () => {
    const storageDir = context.environment.storageDirectory ?? '.';
    const storage = new Storage(storageDir);

    const server = await startServer(() => context.application.song, storage);

    // Register the "Open Live Agent" command
    context.commands.registerCommand('live-agent.open', () => {
      context.ui
        .showModalDialog(`http://127.0.0.1:${server.port}/`, 440, 700)
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
