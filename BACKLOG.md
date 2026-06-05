# Live Agent — Roadmap

Task tracking has moved to **[GitHub Projects](https://github.com/users/nonogv/projects/2)**.
Issues are labelled `v1` / `v2` / `v3` / `sdk` / `ui` / `dx` / `ideas` and grouped by milestone.

This file is kept as a high-level roadmap overview and a record of what shipped.

---

## Status: `0.2.0-alpha.1`

Core loop validated ✅ — multi-step tool use, MIDI note generation, device insertion, parameter tweaking, deletion with confirmation, tempo changes all confirmed working (2026-06-05).

**Shipped so far:**
- React + Vite UI migrated to Tailwind v4, markdown rendering, foldable tool-call blocks, minimal Copilot-like layout
- Full SDK coverage: all 15 classes, auto-generated schemas + executor (`npm run generate`)
- `get_live_state` with tracks, mixer, devices, session/arrangement clips + MIDI notes, scenes, cue points, take lanes, main track
- Three-way confirmation mode: **Review** / **Guard** / **Auto**
- Conversation persistence (load/save across restarts, clear button)
- Provider + model remembered across sessions; settings as closable popup
- Prettier + ESLint + Husky + GitHub Actions CI (no duplicate runs on PRs)
- Gemini multi-turn: `thought_signature` round-trip, `functionResponse.name` fix, skip unsigned history entries
- BigInt handle precision fix: float-to-string registry (`handle-registry.ts`) populates on every `getLiveState` so precision-lossy JSON numbers are recovered via float equality
- Handle registry refreshed on every agentic round (rounds 2+) so stale handles after mid-turn deletions are resolved correctly
- System prompt token reduction: device params, MIDI notes, full audio paths removed from overview; 429 retry with backoff

---

## v1 — Developer release (11 open issues)

*Ship when alpha testing passes and all v1 issues are closed.*

| # | Title | Area |
|---|-------|------|
| [#5](https://github.com/nonogv/live-agent/issues/5) | Test with OpenAI key | QA |
| [#6](https://github.com/nonogv/live-agent/issues/6) | Test with Gemini key | QA |
| [#13](https://github.com/nonogv/live-agent/issues/13) | SDK completeness audit + automated coverage check | sdk |
| [#49](https://github.com/nonogv/live-agent/issues/49) | Settings panel: move to closable popup overlay | ui |
| [#51](https://github.com/nonogv/live-agent/issues/51) | Extension often requires two clicks to open after rebuild | bug |
| [#52](https://github.com/nonogv/live-agent/issues/52) | Session history lost on rebuild when last turn errored | bug |
| [#53](https://github.com/nonogv/live-agent/issues/53) | Blinking orange error indicator persists after rate-limit / quota errors | bug, ui |
| [#54](https://github.com/nonogv/live-agent/issues/54) | Default to cheapest / free model when changing provider | ux |
| [#55](https://github.com/nonogv/live-agent/issues/55) | LLM economy: reduce token usage | performance |
| [#56](https://github.com/nonogv/live-agent/issues/56) | Foldable tool-call block stays visible after disabling the feature | bug, ui |
| [#57](https://github.com/nonogv/live-agent/issues/57) | Style the diagnostic / debug info bubble | ui |

---

## Won't do (for now)

- **In-extension undo / checkpoints** — Live's native **⌘Z / undo** already reverts each agent tool step. No custom checkpoint UI or `Song.undo()` integration until the Extensions SDK exposes programmatic undo. Closing the agent dialog to reach Live's undo is acceptable for v1.

---

## v2 — Power features (6 open issues: #24–#29)

| # | Title |
|---|-------|
| [#24](https://github.com/nonogv/live-agent/issues/24) | Consumer edition — packaged installer and managed auth |
| [#25](https://github.com/nonogv/live-agent/issues/25) | Producer rules — persistent agent instructions |
| [#26](https://github.com/nonogv/live-agent/issues/26) | Rich context — @track / @clip / @device mentions |
| [#27](https://github.com/nonogv/live-agent/issues/27) | Local model support (Ollama / OpenAI-compatible) |
| [#28](https://github.com/nonogv/live-agent/issues/28) | SDK auto-sync CI regeneration step |
| [#29](https://github.com/nonogv/live-agent/issues/29) | Multi-point checkpoint history |

---

## v3 — Platform (2 open issues: #30–#31)

| # | Title |
|---|-------|
| [#30](https://github.com/nonogv/live-agent/issues/30) | Cloud sync — conversation history and rules across machines |
| [#31](https://github.com/nonogv/live-agent/issues/31) | Collaborative sessions — shared agent context |

---

## Ideas to consider (#35–#43)

Max for Live patch generation (#35), M4L bridge for custom devices (#36), cloud plugin parameter database (#37), skill marketplace (#38), cloud render + delivery (#39), mobile remote control (#40), voice-first mobile (#41), hum-to-MIDI (#42), Live theme color sync (#43 — blocked on SDK).

---

## Decisions pending (#32–#34)

- [#32](https://github.com/nonogv/live-agent/issues/32) Finalize license strategy (Apache 2.0 + Commons Clause, currently provisional)
- [#33](https://github.com/nonogv/live-agent/issues/33) Public release timing
- [#34](https://github.com/nonogv/live-agent/issues/34) Ableton extension marketplace distribution
