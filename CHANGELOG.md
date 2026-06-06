# Changelog

All notable changes to Live Agent are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org).

---

## [Unreleased]

### Fixed
- **Auto mode** — skips multi-step continue checkpoints (Review/Guard still pause every 5 steps)
- **Continue checkpoint UI** — accept removes the prompt entirely; decline keeps the message with a stop icon (no duplicate streamed text)
- **`web_search`** — DuckDuckGo Lite for tab-site links (Ultimate Guitar, Songsterr, BigBassTabs, etc.) + ASCII tab excerpts from fetchable pages; Wikipedia kept for song overview

### Added
- **`web_search` tool** — Wikipedia + DuckDuckGo lookup for tempo, bass lines, and other musical reference (no API key)
- **Production & Live learning via `web_search`** — Ableton.com article excerpts, `site:ableton.com` query variants for built-in devices, and system-prompt guidance for mixing/sound-design/Live workflow questions (Wikipedia skipped for production queries)
- **`resources_import_into_project` tool** — copies an audio file from disk into the Live project (SDK `Resources.importIntoProject`)

### Changed
- **Tool error recovery** — SDK tool failures return `{ ok: false, error }` to the LLM instead of aborting the agent loop, so the agent can refresh state and retry (e.g. stale track ids after a partial delete)
- **Live snapshot on layout changes** — track create/delete results (and stale-id failures) include a compact `liveSnapshot` with current track ids so the model does not reuse ids from the opening system prompt
- **Agent continue checkpoints** — pauses every 5 steps (counted across follow-up messages in the same Live session) with Continue/Stop buttons; hard cap 50 steps per user message
- **Clearer clip/device tool descriptions** — session vs arrangement clip tools documented; Drum Rack/Sampler emptiness vs synth defaults
- **Completion verification** — system prompt requires `get_live_state` check before claiming success; arrangement clips listed in state overview

---

## [0.2.1-alpha.1] — 2026-06-05

### Added
- **SDK coverage audit** — automated `sdk-coverage` test fails when SDK methods lack tools; 45 generated tools + `get_live_state` with zero gaps ([#13](https://github.com/nonogv/live-agent/issues/13))
- **`drum_chain_set_receiving_note` tool** — exposes `DrumChain.receivingNote` setter
- **Richer `get_live_state`** — song grid settings, track solo-mute/group, clip markers/loop/color, audio warp markers, scene time signature, parameter quantization, drum chain receiving note, take-lane clips
- **History pruning** — drops oldest assistant+tool pairs when history exceeds 40 entries, preserving all user messages ([#55](https://github.com/nonogv/live-agent/issues/55))
- **Modal open guard** — deduplicates concurrent `showModalDialog` calls; command registers synchronously at activate ([#51](https://github.com/nonogv/live-agent/issues/51))
- **Settings overlay** — closable popup above chat with backdrop dismiss ([#49](https://github.com/nonogv/live-agent/issues/49))
- **Diagnostic info bubble** — sky-blue styled output with Info icon ([#57](https://github.com/nonogv/live-agent/issues/57))
- **Tool visibility toggle** — debug off hides existing tool-call blocks ([#56](https://github.com/nonogv/live-agent/issues/56))

### Fixed
- Session history now persists even when the last turn errors ([#52](https://github.com/nonogv/live-agent/issues/52))
- System prompt token reduction: arrangement clip count hint, mixer send IDs removed from overview ([#55](https://github.com/nonogv/live-agent/issues/55))
- HTTP 429 rate-limit errors trigger automatic retry after Gemini `retryDelay`
- Blinking orange cursor clears on API errors; error bubbles pulse briefly then settle ([#53](https://github.com/nonogv/live-agent/issues/53))
- Default provider/model now cheapest per provider; first launch defaults to Gemini Flash-Lite ([#54](https://github.com/nonogv/live-agent/issues/54))

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
