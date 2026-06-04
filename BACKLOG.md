# Live Agent — Backlog

Status: `0.1.0-alpha` — working end-to-end, private, not yet released.

---

## Now — Alpha testing & bug fixes

~~First contact with the real extension host. Goal: make "Create a MIDI track named Bass" work end to end.~~

Core loop validated ✅ — multi-step tool use, MIDI note generation, and device insertion all confirmed working in a real session (2026-06-05).

- [x] Install Live 12.4.5 beta and load the extension in developer mode
- [x] Verify the extension registers in Live without errors
- [x] Verify the HTTP + WebSocket server starts on a free port
- [x] Open the chat via right-click context menu → verify the webview loads
- [x] Send a basic message ("hello") → verify AI response streams in
- [x] Send "Create a MIDI track named Bass" → verify it executes correctly in Live
- [x] Send "What tracks do I have?" → verify get_live_state returns correct data
- [x] Multi-turn conversation with tool chaining (create clip → name it → write MIDI notes → insert device)
- [ ] Send "Delete the Bass track" → verify deletion works and IDs refresh correctly
- [ ] Send "Set tempo to 140" → verify song.tempo updates in Live
- [ ] Test with OpenAI and Anthropic keys (validated with OpenAI so far)
- [ ] Test what happens when the webview is closed and reopened (server stays up?)
- [ ] Test what happens when Live is closed and reopened (extension re-activates?)

---

## v1 — Developer release

Ship when alpha is stable and all v1 items are done.

### UI migration to React + Vite
*Do this before building any new UI features — it's the foundation.*
- [ ] Add Vite + React + TypeScript to the project (`npm create vite ui -- --template react-ts` or equivalent)
- [ ] Rebuild the chat panel as React components (`<MessageList>`, `<MessageBubble>`, `<ChatInput>`, `<ProviderBar>`)
- [ ] Rebuild the settings panel as React components (`<ApiKeyField>`, `<ProviderSelector>`, `<ModelSelector>`)
- [ ] Wire WebSocket connection to React state (custom `useWebSocket` hook)
- [ ] Handle streaming text updates reactively (append to message in state as chunks arrive)
- [ ] Configure `server.ts` to serve the Vite build output instead of `index.html`
- [ ] Remove the old `src/ui/index.html`

### Tooling & DX
*Do alongside or right after the React migration.*
- [ ] **SCSS** — configure Vite to support `.scss` / `.module.scss`; replace any inline styles in React components with CSS modules
- [ ] **SCSS** — configure Vite to support `.scss` / `.module.scss`; replace any inline styles in React components with CSS modules
- [x] **Prettier** — add `.prettierrc` (single quotes, 2 spaces, trailing commas); add `format` and `format:check` scripts
- [x] **ESLint** — add `eslint.config.ts` with `@eslint/js`, `typescript-eslint`; add `lint` and `lint:fix` scripts
- [x] **Husky + lint-staged** — `pre-commit` hook runs `prettier --check` + `eslint` on staged files only
- [x] **GitHub Actions CI** — workflow on every PR and push to `main`: install deps → typecheck → lint → test; block merge if any step fails
- [x] Update `CONTRIBUTING.md` iteration checklist to mention running `npm run lint` and `npm run format:check`

### Chat UX
- [ ] Markdown rendering in agent messages (bold, code blocks, lists)

### Conversation persistence
- [ ] Add `saveHistory()` / `loadHistory()` to `Storage` class — cap at ~50 messages
- [ ] Load history from storage on server start, save after each completed turn
- [ ] Add "Clear conversation" button in the Settings tab
- [ ] Show message count or a faint timestamp on older messages

### Confirmation mode
- [x] Define destructive tool set in `src/agent/safety.ts` (delete track/scene/clip, etc.)
- [x] Add `confirm_request` / `confirm_response` WebSocket message types
- [x] In `server.ts`: before executing a destructive tool, pause and send `confirm_request`
- [x] In `index.html`: render inline confirm/cancel buttons in the chat stream
- [x] Wire cancel response to abort the tool call and inform the LLM

### Autopilot mode
- [x] Add safe/autopilot toggle button in the chat bar (default: safe)
- [x] Pass `autopilot: boolean` with each chat message
- [x] In `server.ts`: if autopilot, skip confirmation and execute immediately

### Checkpoint system (via withinTransaction)
- [ ] Wrap all tool calls within a single agent turn in `withinTransaction()` in `server.ts`
- [ ] Handle the async edge cases (withinTransaction callback must be synchronous — verify approach)
- [ ] After each turn, show a subtle "Revert with ⌘Z" note in the chat
- [ ] Document the limitation: one undo step per turn, not full history

---

## v2 — Power features

- [ ] Consumer edition — packaged installer, managed auth, zero technical setup
- [ ] Producer rules — persistent per-session or global agent instructions
- [ ] Rich context — @track / @clip / @device mentions in chat to focus the agent
- [ ] Local model support — Ollama / any OpenAI-compatible local server
- [ ] SDK auto-sync — CI regeneration (requires Ableton to publish SDK to a public registry)
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
