# GitHub Copilot Instructions — Live Agent

Full standards are in [`CONTRIBUTING.md`](../CONTRIBUTING.md).

## Quick reference

- **Language:** TypeScript, strict mode, ESM (`"module": "NodeNext"`)
- **Imports:** always use `.js` extension for local imports
- **No `any`** — use `unknown` and narrow with type guards
- **Testing:** Vitest, tests in `*.test.ts` files next to source
- **UI:** React — functional components and hooks only, built with Vite. No class components.
- **Generated files:** `src/agent/generated-tools.ts` and `src/live/generated-executor.ts` — never edit by hand

## Every PR / meaningful change
- New logic → new tests
- Exported symbols → JSDoc
- Public-facing change → README update
- Completed backlog item → tick it in BACKLOG.md

## Core principle
The basic extension must always be free to use — local model support and bring-your-own-key are permanent features, not optional.
