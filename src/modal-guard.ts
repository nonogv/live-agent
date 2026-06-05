/**
 * Serializes modal dialog opens so rapid duplicate requests (e.g. double-clicks or
 * context-menu retries after a hot reload) are ignored while a dialog is already open.
 */
export interface ModalGuard {
  /** Whether a modal open is currently in flight or the dialog is shown. */
  isOpen(): boolean;
  /**
   * Runs `openFn` unless a modal is already open. Waits for any prior in-flight
   * open to settle before starting a new one after the previous dialog closes.
   */
  open(openFn: () => Promise<void>): Promise<void>;
}

/**
 * Creates a guard that deduplicates concurrent `showModalDialog` calls.
 */
export function createModalGuard(): ModalGuard {
  let modalOpen = false;
  let modalPromise: Promise<void> | null = null;

  return {
    isOpen(): boolean {
      return modalOpen;
    },

    async open(openFn: () => Promise<void>): Promise<void> {
      if (modalOpen) {
        console.log('[Live Agent] Dialog already open — ignoring duplicate open request');
        return;
      }

      if (modalPromise) {
        await modalPromise.catch(() => {
          // Prior open failed; allow a fresh attempt below.
        });
      }

      modalOpen = true;
      modalPromise = openFn()
        .catch((err: unknown) => {
          console.error('[Live Agent] Dialog error:', err);
        })
        .finally(() => {
          modalOpen = false;
          modalPromise = null;
        });

      await modalPromise;
    },
  };
}
