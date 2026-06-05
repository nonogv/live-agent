# Live Agent — Backlog

Status: `0.2.0-alpha.1` — React UI, full SDK coverage, conversation persistence, confirmation + autopilot all landed.

---

## Now — Alpha testing & integration

Core loop validated ✅ — multi-step tool use, MIDI note generation, device insertion, parameter tweaking, deletion with confirmation, tempo changes all confirmed working in a real session (2026-06-05).

- [x] Install Live 12.4.5 beta and load the extension in developer mode
- [x] Verify the extension registers in Live without errors
- [x] Verify the HTTP + WebSocket server starts on a free port
- [x] Open the chat via right-click context menu → verify the webview loads
- [x] Send a basic message ("hello") → verify AI response streams in
- [x] Send "Create a MIDI track named Bass" → verify it executes correctly in Live
- [x] Send "What tracks do I have?" → verify get_live_state returns correct data
- [x] Multi-turn conversation with tool chaining (create clip → name it → write MIDI notes → insert device)
- [x] Chat history persists across webview close/reopen
- [x] Send "Delete the Bass track" → verify deletion works and IDs refresh correctly (confirmation dialog shown)
- [x] Send "Set tempo to 140" → verify `song_set_tempo` updates in Live
- [x] Test with Anthropic key
- [ ] Test with OpenAI key
- [ ] Test with Gemini key — bugs fixed (HTTP error surfacing + `functionResponse.name` in multi-turn calls); re-test with a valid key
- [x] Test what happens when Live is closed and reopened (extension re-activates, history reloads ✅)

---

## v1 — Developer release

Ship when alpha testing is complete and all v1 items below are done.

### Provider fixes

- [x] Gemini: HTTP errors (4xx/5xx) now surfaced as thrown errors instead of silently yielding nothing
- [x] Gemini: `functionResponse.name` now carries the actual tool name in multi-turn conversations
- [ ] Remember last used provider + model across sessions — remove the "Default Model" setting from `SettingsPanel`, instead persist `lastProvider` / `lastModel` to storage whenever a message is sent and restore on load

### SDK coverage

- [x] Auto-generate tool schemas and executor from SDK types (`npm run generate`)
- [ ] **SDK completeness audit** — once all current coverage gaps are closed, do a systematic review: compare every exported class/method in the SDK against the generated schemas and executor dispatch table; write a script or test that fails if any public SDK member is unrepresented; repeat after each SDK update
- [x] All SDK classes covered: Song, Track, MidiTrack, AudioTrack, ClipSlot, Clip, MidiClip, AudioClip, Scene, CuePoint, Device, DeviceParameter, Simpler, RackDevice, Chain, TakeLane
- [x] `get_live_state` returns full session snapshot: tracks (regular + return), scenes, cue points, mixer (vol/pan/sends), devices with parameters (min/max/default), session + arrangement clips with MIDI notes, take lanes, main track
- [x] `findDevice` / `findDeviceParameter` search main track and rack chains
- [x] Enum values in tool schemas resolve to human-readable descriptions (e.g. `0 (Beats), 1 (Tones)…`)
- [ ] AudioClip properties in live state (`filePath`, `warping`, `warpMode`) — needed for warp editing workflows
- [ ] Song scale/key in live state (`rootNote`, `scaleName`, `scaleMode`) — needed for intelligent note generation
- [ ] `Promise<void>` SDK methods not awaited in executor — generator checks `.includes("void")` so `Promise<void>` skips `await`; fix to exact match `=== "void"`
- [ ] `ClipLoopSettings` object undocumented in the three `createAudioClip` tool schemas
- [ ] Scene tempo `-1` not explained in system prompt (means "inherits from Song tempo", not a real BPM value)

### React + Vite UI

- [x] Vite + React + TypeScript setup
- [x] All components: `ChatPanel`, `MessageList`, `MessageBubble`, `ChatInput`, `ProviderBar`, `SettingsPanel`, `ApiKeyField`, `EmptyState`
- [x] WebSocket hook with reconnect and streaming state via `useReducer`
- [x] Autopilot toggle and confirmation card in React UI
- [x] Server serves `dist/ui/` (Vite build output)

### Tooling & DX

- [x] Prettier, ESLint, Husky + lint-staged, GitHub Actions CI
- [x] SCSS modules, Vite build pipeline
- [x] `lucide-react` installed (ready for use across all UI components)
- [ ] **App icon** — add a custom SVG icon asset and reference it in `manifest.json` (check SDK docs for supported `icon` field); use Lucide icons throughout the UI to replace the current text-label buttons (Tools, Diagnose, Clear, etc.)
- [ ] **File-per-concern component structure** — adopt the folder-per-component convention: `components/Foo/Foo.tsx` + `Foo.module.scss` + `Foo.test.tsx`; extract logic into custom hooks (`useFoo.ts`) when a component has significant non-rendering state; update `CONTRIBUTING.md` with this convention

### Chat UX — UI polish

The goal is a minimal, Copilot-like feel: clean chat flow, no visual noise, tool calls and reasoning visible but unobtrusive. Tailwind v4 is the right foundation — it's the current standard for React in 2026, works natively with Vite via `@tailwindcss/vite`, and eliminates the SCSS module per-component overhead. Ableton's palette maps cleanly to a Tailwind custom theme.

- [ ] **Migrate to Tailwind v4** — install `tailwindcss` + `@tailwindcss/vite`, replace all `.module.scss` files with Tailwind utility classes, define a custom theme with Ableton-inspired colors (dark gray backgrounds, orange/amber accent `#e56a00`, neutral grays for secondary text)
- [ ] **Minimal chat layout** — remove "YOU" / "LIVE AGENT" heading labels from every bubble; user messages right-aligned with subtle background, agent messages plain left-aligned text; reduce inter-bubble spacing and borders to a single faint separator line
- [ ] **Bigger window** — increase `showModalDialog` dimensions from `440 × 700` to `480 × 760` in `extension.ts`
- [ ] **Tool call / reasoning fold** — tool messages shown in lighter muted color while the agent is running; once the final answer arrives, they collapse to a single summary line (e.g. `▸ 3 tool calls`) that expands on click; no external library needed, just CSS transition + `useReducer`
- [ ] **Markdown rendering** — `MessageBubble` renders plain text today; add `react-markdown` + `remark-gfm` for bold, code blocks, and tables in agent messages

### Conversation persistence

- [x] `saveHistory()` / `loadHistory()` in `Storage` — capped at 100 messages
- [x] History loaded on server start, saved after each turn
- [x] History restored in UI on every new WebSocket connection (close + reopen the panel → chat is back)
- [x] "Clear" button clears both UI state and persisted history
- [x] `history.json` excluded from git (runtime data)

### Confirmation mode

- [x] `DESTRUCTIVE_TOOLS` set in `src/agent/safety.ts`
- [x] `confirm_request` / `confirm_response` WebSocket protocol
- [x] Server pauses before destructive tools and awaits user response
- [x] Confirmation card rendered inline in the chat (React)
- [x] Three-way mode: **Review** (confirm every tool call) / **Guard** (confirm destructive only, default) / **Auto** (no confirmations) — replaces the old binary autopilot toggle

### Checkpoint system

`withinTransaction` lives on `ExtensionContext` (not `Song`). The callback **must be synchronous**, which conflicts with our async tool calls. Needs design work before coding.

- [ ] Pass `context` (or `context.application.withinTransaction`) into `startServer` — currently only `getSong` is injected
- [ ] Design how to wrap async tool calls inside a sync `withinTransaction` callback — options: collect all tool IDs first then execute synchronously, or check if the SDK actually awaits the callback at runtime
- [ ] After each agent turn, send a `{ type: 'turn_committed' }` WS message so the UI can show "Revert with ⌘Z"
- [ ] Document the limitation: one undo step per turn (Live's undo stack), not full multi-turn history

---

## v2 — Power features

- [ ] Consumer edition — packaged installer, managed auth, zero technical setup
- [ ] Producer rules — persistent per-session or global agent instructions ("always use minor pentatonic", "never delete tracks without asking")
- [ ] Rich context — @track / @clip / @device mentions in chat to focus the agent
- [ ] Local model support — Ollama / any OpenAI-compatible local server
- [ ] SDK auto-sync — CI regeneration step (requires Ableton to publish SDK to a public npm registry)
- [ ] Multi-point checkpoint history — copy `.als` file before each turn, offer restore UI

---

## v3 — Platform

- [ ] Cloud sync — conversation history and rules across machines
- [ ] Collaborative sessions — shared agent context for remote co-production

---

## Decisions pending

- [ ] Finalize license strategy (currently Apache 2.0 + Commons Clause, marked provisional)
- [ ] Decide on public release timing after v1 is stable
- [ ] Evaluate Ableton extension marketplace distribution once it exists
