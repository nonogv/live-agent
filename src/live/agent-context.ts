import type { Resources, Song } from '@ableton-extensions/sdk';

/** Runtime services passed to custom agent tools (beyond Song). */
export interface AgentContext {
  getSong: () => Song<'1.0.0'>;
  /** When set, exposes SDK `Resources.importIntoProject`. */
  resources?: Pick<Resources<'1.0.0'>, 'importIntoProject'>;
}
