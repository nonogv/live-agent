/**
 * Custom tools that augment the auto-generated SDK tools.
 *
 * These cover aggregated reads and operations that don't map 1:1 to a single
 * SDK method — they're intentionally kept small. Everything else lives in
 * generated-tools.ts (run `npm run generate` to update).
 */

import type { ToolSchema } from '../providers/index.js';

export const CUSTOM_TOOL_SCHEMAS: ToolSchema[] = [
  {
    name: 'get_live_state',
    description:
      'Returns a full snapshot of the current session: tempo and all tracks with their ids, names and types. ' +
      "Call this first whenever you need to know what's in the session or to get fresh track ids.",
    parameters: {
      type: 'object',
      properties: {},
    },
  },
];
