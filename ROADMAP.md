# Live Agent — Roadmap

Issues and detailed task tracking live in **[GitHub Projects](https://github.com/users/nonogv/projects/2)**, labelled `v1` / `v2` / `v3` / `sdk` / `ui` / `dx` / `ideas`.

This file captures the high-level direction. See [`CHANGELOG.md`](./CHANGELOG.md) for what has already shipped.

---

## v1 — Developer release *(in progress)*

Goal: a polished, stable experience for developer-musicians who build from source and bring their own API key.

- Provider / model UX — default to cheapest/free model, settings as closable popup
- UI polish — error state styling, foldable tool-call blocks, diagnostic bubble
- Stability — double-click-to-open issue, history loss on errored rebuild
- SDK completeness audit — verify full coverage and generator robustness
- Manual QA — OpenAI and Gemini end-to-end test sign-off

**Won't do (for now):** in-extension undo / checkpoints. Live's native **⌘Z** already reverts each agent tool step. Revisit if the SDK exposes programmatic undo.

---

## v2 — Power features

Goal: expand the audience and depth of the tool.

- Consumer edition — packaged installer, managed auth, zero setup for non-developer musicians
- Producer rules — persistent per-session or global agent instructions ("always 4/4", "prefix tracks with section")
- Rich context — @track / @clip / @device targeting in chat
- Local model support — Ollama and other OpenAI-compatible servers, no API key required
- SDK auto-sync — CI step to regenerate schemas when Ableton publishes a new SDK release

---

## v3 — Platform

Goal: make Live Agent a collaborative and cloud-connected tool.

- Cloud sync — conversation history and rules across machines
- Collaborative sessions — shared agent context for remote co-production

---

## Ideas (not yet scheduled)

Max for Live patch generation, M4L bridge for custom device control, cloud plugin parameter database, skill/prompt marketplace, cloud render + delivery, mobile remote control, voice-first mobile interface, hum-to-MIDI, Live theme colour sync (blocked on SDK exposure).

---

## Decisions pending

- Finalize license strategy (Apache 2.0 + Commons Clause — currently provisional)
- Public release timing
- Ableton extension marketplace distribution strategy
