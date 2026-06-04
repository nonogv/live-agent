# Contributing to Live Agent

This file is the source of truth for development standards. All AI assistant configs (`.cursor/rules/`, `.github/copilot-instructions.md`) reference this document.

---

## Philosophy

**Live Agent must always be free to use in its basic form.**

Any student, hobbyist, or musician must be able to run the extension with a free or local model — no charges from us, no account required. This is non-negotiable. Features that require infrastructure (cloud sync, managed auth) may be offered as optional paid tiers in the future, but the core tool — local extension, bring-your-own-key or local model — stays free forever.

---

## Tech stack

- **Runtime:** Node.js v24 (ESM, `"type": "module"`)
- **Language:** TypeScript with `"module": "NodeNext"` / `"moduleResolution": "NodeNext"`
- **Extension host:** Ableton Extensions SDK (`@ableton-extensions/sdk`)
- **UI:** React (functional components, hooks, no class components) — built with Vite, served by the local HTTP server
- **AI providers:** OpenAI, Anthropic, Google Gemini (user-supplied keys)
- **Testing:** Vitest

---

## React standards

- **Functional components only** — no class components.
- **Hooks for everything** — `useState`, `useEffect`, `useRef`, `useCallback`, `useMemo` as appropriate. Extract custom hooks for reusable logic.
- **Keep components small and focused** — one responsibility per component. Split when a component grows beyond ~100 lines.
- **Streaming state** — use `useReducer` or a stream-aware state pattern for chat message streams, not ad-hoc `useState` chains.
- **No prop drilling** — use context or a lightweight state manager (Zustand or React's built-in context) if state needs to cross more than two levels.
- **CSS modules or Tailwind** — no inline styles except for truly dynamic values. Keep styles colocated with components.
- **No `any` in component props** — type all props explicitly; prefer interfaces over type aliases for component props.

```tsx
// ❌
export default function Message(props: any) { ... }

// ✅
interface MessageProps {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}
export function Message({ role, content, streaming = false }: MessageProps) { ... }
```

## TypeScript standards

- **Strict mode is on.** No `any` unless absolutely unavoidable — use `unknown` and narrow.
- **Always use `.js` extensions** in local imports (ESM requirement): `import { foo } from "./foo.js"`.
- **Prefer `unknown` over `any`** for external data; narrow with type guards.
- **Errors must be handled.** Never silently swallow — log and rethrow or surface to the user.
- **No unused imports or variables.** The linter will catch them, fix before committing.
- **`as never` and `as unknown as T`** are acceptable only in generated code or when the type system genuinely cannot express the constraint.

```typescript
// ❌
} catch (e) {}

// ✅
} catch (e) {
  console.error("Failed to execute tool:", e);
  throw e;
}
```

---

## JSDoc

Every exported function, class, and non-obvious constant must have a JSDoc comment.

```typescript
// ❌
export function buildSystemPrompt(state: LiveState): string {

// ✅
/**
 * Builds the system prompt injected at the start of every AI conversation turn.
 * Includes current session state (tempo, tracks) and tool usage guidance.
 */
export function buildSystemPrompt(state: LiveState): string {
```

- One-liners are fine for simple getters/constants.
- Document parameters when their purpose isn't obvious from the name.
- Do **not** add comments that just restate the code. Explain *why*, not *what*.

---

## Versioning

We follow [Semantic Versioning](https://semver.org): `MAJOR.MINOR.PATCH[-prerelease]`.

- **PATCH** — bug fixes, no API or behavior change (`0.1.1`)
- **MINOR** — new features, backwards-compatible (`0.2.0`)
- **MAJOR** — breaking changes or a significant milestone release (`1.0.0`)
- **Pre-release suffixes** — `alpha` → `beta` → `rc` before stable (`1.0.0-alpha.1`, `1.0.0-beta.2`, `1.0.0-rc.1`)

Current track: `0.x` is the developer preview. `1.0.0` is the v1 developer release (see `BACKLOG.md`).

Bump the version in `package.json` as part of the commit that represents the milestone — not in a separate commit. Tag the release in git: `git tag v0.2.0`.

---

## Iteration checklist

Every meaningful change must include:

- [ ] **Unit tests** — new logic gets new tests; existing tests stay green
- [ ] **JSDoc** — exported symbols are documented
- [ ] **README update** — if the change affects setup, capabilities, or public-facing behavior
- [ ] **BACKLOG update** — tick completed tasks, add discovered issues
- [ ] **Version bump** — if the change crosses a milestone (patch/minor/major); tag the release

Generated files (`src/agent/generated-tools.ts`, `src/live/generated-executor.ts`) are exempt from manual JSDoc — they are produced by `npm run generate` and should not be edited by hand.

---

## Testing

We use **Vitest**. Tests live next to source files as `*.test.ts`.

```bash
npm test           # run all tests
npm run test:watch # watch mode
```

- **Unit tests** for pure functions and storage — no network, no Live SDK.
- **SDK-dependent code** (`executor.ts`, `server.ts`) is tested with mocks; add them as the mock surface becomes clear.
- Tests should be fast. If a test needs real I/O, use `os.tmpdir()` and clean up in `afterEach`.
- Do not test generated files directly — test the generator script's output shape.

---

## Commit conventions

```
feat: short description     # new capability
fix: short description      # bug fix
chore: short description    # tooling, deps, config
docs: short description     # README, JSDoc, BACKLOG
test: short description     # tests only
```

Keep commit messages in the imperative ("add", "fix", "remove") and under 72 characters for the subject line.

---

## Generated files

`src/agent/generated-tools.ts` and `src/live/generated-executor.ts` are auto-generated. To regenerate after an SDK update:

```bash
npm install /path/to/new-sdk
npm run generate
npm run typecheck
```

Commit all three changes together.
