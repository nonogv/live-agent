# Live Agent — Backlog

Status: `0.1.0-alpha` — untested, private, not released.

---

## Now — Alpha testing & bug fixes

First contact with the real extension host. Goal: make "Create a MIDI track named Bass" work end to end.

- [ ] Install Live 12.4.5 beta and load the extension in developer mode
- [ ] Verify the extension registers in Live without errors (check Live's extension log)
- [ ] Verify the HTTP + WebSocket server starts on a free port
- [ ] Open the chat via right-click context menu → verify the webview loads
- [ ] Add a Gemini API key in Settings → verify it saves and persists across restarts
- [ ] Send a basic message ("hello") → verify AI response streams in
- [ ] Send "Create a MIDI track named Bass" → verify it executes correctly in Live
- [ ] Send "What tracks do I have?" → verify get_live_state returns correct data
- [ ] Send "Delete the Bass track" → verify deletion works and handle IDs refresh correctly
- [ ] Send "Set tempo to 140" → verify song.tempo updates in Live
- [ ] Test with OpenAI and Anthropic keys as well
- [ ] Test session with multiple back-and-forth turns — check for memory/history issues
- [ ] Test what happens when the webview is closed and reopened (server stays up?)
- [ ] Test what happens when Live is closed and reopened (extension re-activates?)
- [ ] Identify and fix all crashes, type errors, and unexpected behaviors found above

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
- [ ] **Prettier** — add `.prettierrc` (single quotes, 2 spaces, trailing commas); add `format` and `format:check` scripts
- [ ] **ESLint** — add `eslint.config.ts` with `@eslint/js`, `typescript-eslint`, `eslint-plugin-react`, `eslint-plugin-react-hooks`; add `lint` and `lint:fix` scripts
- [ ] **Husky + lint-staged** — `pre-commit` hook runs `prettier --check` + `eslint` on staged files only
- [ ] **GitHub Actions CI** — workflow on every PR and push to `main`: install deps → typecheck → lint → test; block merge if any step fails
- [ ] Update `CONTRIBUTING.md` iteration checklist to mention running `npm run lint` and `npm run format:check`

### Conversation persistence
- [ ] Add `saveHistory()` / `loadHistory()` to `Storage` class — cap at ~50 messages
- [ ] Load history from storage on server start, save after each completed turn
- [ ] Add "Clear conversation" button in the Settings tab
- [ ] Show message count or a faint timestamp on older messages

### Confirmation mode
- [ ] Define destructive tool set in `src/agent/safety.ts` (delete track/scene/clip, etc.)
- [ ] Add `confirm_request` / `confirm_response` WebSocket message types
- [ ] In `server.ts`: before executing a destructive tool, pause and send `confirm_request`
- [ ] In `index.html`: render inline confirm/cancel buttons in the chat stream
- [ ] Wire cancel response to abort the tool call and inform the LLM

### Autopilot mode
- [ ] Add safe/autopilot toggle button in the chat bar (default: safe)
- [ ] Pass `autopilot: boolean` with each chat message
- [ ] In `server.ts`: if autopilot, skip confirmation and execute immediately

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
