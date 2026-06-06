import { initialize, type ActivationContext } from '@ableton-extensions/sdk';
import { Storage } from './storage.js';
import { startServer, type LiveAgentServer } from './server.js';
import { createModalGuard } from './modal-guard.js';

/**
 * Modal dialog dimensions (width × height in pixels).
 * The SDK `showModalDialog` API only accepts fixed pixel sizes — no percentage
 * width or user-resizable chrome. 600px width is the target for ~40% on typical displays.
 */
const DIALOG_WIDTH = 600;
const DIALOG_HEIGHT = 820;

const CONTEXT_MENU_SCOPES = [
  'MidiTrack',
  'AudioTrack',
  'Scene',
  'MidiClip',
  'AudioClip',
  'ClipSlot',
] as const;

/** Tracks scopes registered in this JS realm to avoid duplicate registration attempts. */
const registeredMenuScopes = new Set<string>();

export const activate = (activation: ActivationContext): void => {
  const context = initialize(activation, '1.0.0');
  const modalGuard = createModalGuard();

  console.log('[Live Agent] Extension activated');

  let server: LiveAgentServer | undefined;

  const serverReady: Promise<void> = (async () => {
    const storageDir = context.environment.storageDirectory ?? '.';
    console.log(`[Live Agent] storageDir=${storageDir}`);
    const storage = new Storage(storageDir);

    server = await startServer(() => context.application.song, storage);

    for (const scope of CONTEXT_MENU_SCOPES) {
      if (registeredMenuScopes.has(scope)) {
        continue;
      }
      registeredMenuScopes.add(scope);
      context.ui
        .registerContextMenuAction(scope, 'Open Live Agent', 'live-agent.open')
        .then(() => console.log(`[Live Agent] Context menu registered for ${scope}`))
        .catch((err: unknown) => {
          registeredMenuScopes.delete(scope);
          console.error(`[Live Agent] Failed to register ${scope}:`, err);
        });
    }

    console.log(`[Live Agent] Ready — ${context.application.song.tracks.length} tracks loaded`);
  })();

  const openDialog = (): void => {
    void modalGuard.open(async () => {
      await serverReady;
      if (!server) {
        console.warn('[Live Agent] Server not ready — cannot open dialog yet');
        return;
      }
      console.log(`[Live Agent] Opening dialog ${DIALOG_WIDTH}×${DIALOG_HEIGHT}`);
      await context.ui.showModalDialog(
        `http://127.0.0.1:${server.port}/`,
        DIALOG_WIDTH,
        DIALOG_HEIGHT,
      );
    });
  };

  // Register synchronously so the command exists before async init finishes.
  // After hot reload the first context-menu click may arrive while the server
  // is still starting; openDialog waits on serverReady instead of no-op'ing.
  context.commands.registerCommand('live-agent.open', openDialog);
};
