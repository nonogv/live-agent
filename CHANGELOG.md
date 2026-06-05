# Changelog

All notable changes to Live Agent are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org).

---

## [Unreleased]

### Fixed
- System prompt token reduction: device parameter lists, inline MIDI notes, and full audio paths removed from the overview; the LLM calls `get_live_state` when it needs detail
- HTTP 429 rate-limit errors now trigger an automatic retry after the delay specified in the Gemini response (`retryDelay` field)

---

## [0.2.0-alpha.1] — 2026-06-05

### Added
- **Full SDK coverage** — all 15 SDK classes (`Song`, `Track`, `MidiTrack`, `AudioTrack`, `ClipSlot`, `Clip`, `MidiClip`, `AudioClip`, `Scene`, `CuePoint`, `Device`, `DeviceParameter`, `Simpler`, `RackDevice`, `Chain`, `TakeLane`) exposed as callable tools; auto-generated schemas + executor via `npm run generate`
- **Rich live state** — `get_live_state` now returns tracks (mute/solo/arm), devices, session/arrangement clips + MIDI notes, mixer (volume/pan/sends), scenes, cue points, take lanes, and the main track
- **Three-way confirmation mode** — Review (confirm every tool call) / Guard (confirm destructive operations only) / Auto (no confirmation)
- **Conversation persistence** — chat history saved to disk and restored on restart; clear button in the UI
- **Provider memory** — last-used provider and model persisted across sessions
- **React + Vite UI** — migrated from flat HTML to React with functional components, hooks, and `useReducer` chat state machine
- **Tailwind v4** — replaced SCSS with Tailwind; Ableton-inspired colour palette; workaround for `@layer` not applying in Ableton's embedded Chromium
- **Markdown rendering** — agent responses rendered with `react-markdown` + `remark-gfm`
- **Foldable tool-call blocks** — tool calls and results collapse when a final answer arrives, matching Cursor's UX
- **Gemini multi-turn** — `thought_signature` round-trip; old history entries without a signature are silently skipped to avoid `INVALID_ARGUMENT` errors; `functionResponse.name` required by Gemini API now always set
- **BigInt handle precision** — `handle-registry.ts` maps `float64(handle) → exact string`; populated by `getLiveState` each turn so precision-lossy JSON numbers from LLM tool calls are recovered via float equality
- **Handle registry refresh** — registry re-populated on rounds 2+ of the agentic loop so mid-turn deletions don't leave stale handles
- **Tooling** — Prettier, ESLint (flat config), Husky pre-commit, GitHub Actions CI (no duplicate runs on PRs), Vitest unit tests
- **Lucide icons** throughout the UI
- **`prestart` guard** — kills stale `ExtensionHostNodeModule` processes before each `npm start`

### Fixed
- `URL is not defined` in Extension Host sandbox — replaced all AI provider SDKs with a minimal `node:https` streaming client
- Multi-step agent loop — `handleChat` now runs a `while (round < MAX_ROUNDS)` agentic loop; previously only one LLM round executed per user message
- UI `uiDir` path — served `dist/ui/` from the wrong relative path after the React migration, causing a white screen
- Tool execution errors masked — `.catch()` now only falls back to custom tools for `Unknown generated tool` errors; real SDK errors are rethrown and surfaced to the user
- `Promise<void>` tool calls — generator's `typeToReturnDescription` now correctly identifies `Promise<void>` so the executor `await`s void SDK methods
- `Chain` name — SDK `Chain` objects have no `name` property; executor now assigns `"Chain N"` as a display name
- CI duplicate runs — workflow changed to `push: branches: [main]` so feature-branch pushes don't trigger a second job alongside the pull-request job

---

## [0.1.0-alpha] — 2026-05-29 *(initial private commit)*

### Added
- Ableton Extension scaffold — `manifest.json`, `extension.ts`, `server.ts`
- Local HTTP + WebSocket server for real-time chat streaming between the Extension Host and the webview
- Basic flat-HTML webview UI with provider selector, API key input, and chat interface
- OpenAI, Anthropic, and Gemini support via direct `node:https` streaming
- Initial tool schemas for core SDK operations (track create/delete/rename, clip operations, device insert)
- `scripts/generate-tools.ts` — first version of the SDK type parser using `ts-morph`
- Storage module for API key persistence
- `README.md`, `CONTRIBUTING.md`, Apache 2.0 + Commons Clause `LICENSE`
