/**
 * Type declarations for the Ableton Extensions SDK (@ableton/live).
 *
 * The actual package ships with the SDK download from Centercode (beta program).
 * Install it locally once you have the SDK:
 *   npm install /path/to/ableton-extensions-sdk/package
 *
 * These declarations mirror the public beta API surface (Live 12.4.5).
 * They will be superseded by the official types once the SDK is installed.
 */
declare module "@ableton/live" {
  // ─── Core bootstrap ───────────────────────────────────────────────────────

  export interface ActivationContext {
    readonly extensionId: string;
    readonly extensionVersion: string;
  }

  export interface LiveContext {
    readonly song: Song;
    readonly ui: UI;
    readonly storage: Storage;
  }

  export function initialize(
    activationContext: ActivationContext,
    apiVersion: string
  ): Promise<LiveContext>;

  // ─── Song / Live Object Model ─────────────────────────────────────────────

  export interface Song {
    readonly tempo: number;
    readonly timeSignatureNumerator: number;
    readonly timeSignatureDenominator: number;
    readonly tracks: readonly Track[];
    readonly scenes: readonly Scene[];

    createMidiTrack(options?: { name?: string; index?: number }): Promise<MidiTrack>;
    createAudioTrack(options?: { name?: string; index?: number }): Promise<AudioTrack>;
  }

  export type Track = MidiTrack | AudioTrack;

  export interface BaseTrack {
    readonly id: string;
    readonly name: string;
    readonly isMuted: boolean;
    readonly isSolo: boolean;
    readonly clipSlots: readonly ClipSlot[];

    setName(name: string): Promise<void>;
    setMuted(muted: boolean): Promise<void>;
    delete(): Promise<void>;
    duplicate(): Promise<Track>;
  }

  export interface MidiTrack extends BaseTrack {
    readonly type: "midi";
    createClip(options: { slotIndex: number; length?: number }): Promise<MidiClip>;
  }

  export interface AudioTrack extends BaseTrack {
    readonly type: "audio";
  }

  export interface ClipSlot {
    readonly index: number;
    readonly clip: MidiClip | AudioClip | null;
    readonly hasClip: boolean;

    fire(): Promise<void>;
    stop(): Promise<void>;
  }

  export interface BaseClip {
    readonly id: string;
    readonly name: string;
    readonly length: number;
    readonly isPlaying: boolean;
    readonly color: number;

    setName(name: string): Promise<void>;
    setColor(color: number): Promise<void>;
    duplicate(): Promise<BaseClip>;
    delete(): Promise<void>;
  }

  export interface MidiClip extends BaseClip {
    readonly type: "midi";
    readonly notes: readonly MidiNote[];

    addNotes(notes: MidiNote[]): Promise<void>;
    removeNotes(options: { pitch?: number; time?: number; duration?: number }): Promise<void>;
    setNotes(notes: MidiNote[]): Promise<void>;
  }

  export interface AudioClip extends BaseClip {
    readonly type: "audio";
    readonly warpMode: WarpMode;
  }

  export interface MidiNote {
    pitch: number;
    time: number;
    duration: number;
    velocity: number;
  }

  export type WarpMode =
    | "beats"
    | "tones"
    | "texture"
    | "re-pitch"
    | "complex"
    | "complex-pro";

  export interface Scene {
    readonly id: string;
    readonly name: string;
    readonly index: number;

    setName(name: string): Promise<void>;
    fire(): Promise<void>;
  }

  // ─── UI ───────────────────────────────────────────────────────────────────

  export interface UI {
    showWebView(options: WebViewOptions): Promise<WebViewHandle>;
    showDialog(options: DialogOptions): Promise<DialogResult>;
    showProgressDialog(options: ProgressOptions): Promise<ProgressHandle>;
  }

  export interface WebViewOptions {
    title: string;
    /** Path to HTML file relative to extension root, or inline HTML string */
    url: string;
    width?: number;
    height?: number;
    resizable?: boolean;
  }

  export interface WebViewHandle {
    /** Send a message to the webview. Received via window.liveAgent.onMessage */
    send(message: unknown): void;
    /** Called when webview sends a message via window.liveAgent.send() */
    onMessage(handler: (message: unknown) => void): void;
    close(): void;
  }

  export interface DialogOptions {
    title: string;
    message: string;
    buttons?: string[];
  }

  export interface DialogResult {
    button: string;
  }

  export interface ProgressOptions {
    title: string;
    message?: string;
    cancellable?: boolean;
  }

  export interface ProgressHandle {
    update(options: { message?: string; progress?: number }): void;
    complete(): void;
    cancel(): void;
  }

  // ─── Storage ──────────────────────────────────────────────────────────────

  export interface Storage {
    /** Persistent key/value store, survives restarts */
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
  }
}
