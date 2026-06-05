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

## v1 — Developer release (~30 open issues)

*Ship when alpha testing passes and all v1 issues are closed.*

Remaining work clusters into four areas:
1. **Alpha testing** — OpenAI and Gemini manual QA (#5, #6)
2. **SDK completeness audit** — double-check full SDK exposure and generator robustness (#13)
3. **UI / UX bugs** — error indicator persists after rate-limit (#53), foldable tool block visible after disable (#56), diagnostic bubble styling (#57), settings popup (#49)
4. **Provider / model UX** — default cheapest model on provider switch (#54), token economy (#55)
5. **Stability bugs** — double-click to open after rebuild (#51), history lost on errored rebuild (#52)

---

## Won't do (for now)

- **In-extension undo / checkpoints (#20–#23)** — Live's native **⌘Z / undo** already reverts each agent tool step. No custom checkpoint UI or `Song.undo()` integration until the Extensions SDK exposes programmatic undo (or we have a compelling reason to rebuild what Live already does). Closing the agent dialog to reach Live's undo is acceptable for v1.

---

## v2 — Power features (#24–#29)

Consumer installer, producer rules, @mentions, local models, SDK auto-sync. Multi-point checkpoint history (#29) remains deferred — same rationale as #20–#23 unless SDK or UX constraints change.

---

## v3 — Platform (#30–#31)

Cloud sync, collaborative sessions.

---

## Ideas to consider (#35–#43)

Max for Live patch generation, M4L bridge for deeper DAW access, cloud plugin parameter database, skill marketplace, cloud render + delivery, mobile remote control, voice-first mobile, hum-to-MIDI, Live theme color sync (blocked on SDK).

---

## Decisions pending (#32–#34)

- Finalize license strategy (Apache 2.0 + Commons Clause, currently provisional)
- Public release timing
- Ableton extension marketplace distribution
