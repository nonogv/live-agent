# Live Agent

AI-powered assistant built into Ableton Live. Chat with GPT, Claude, or Gemini to control your session using natural language.

> "Create a MIDI track named Bass." → Done.

## What it does

Live Agent is an Ableton Extension that opens a chat panel inside Live. You type instructions in plain English and the agent executes them directly on your session using the Ableton Extensions SDK.

Tool schemas are **auto-generated** from the SDK type definitions — every method and setter the SDK exposes becomes a callable tool. This means coverage stays in sync with SDK updates automatically.

**Free to use, always.** The basic extension works with free-tier or local models — no account required, no charges from us. A student with a free Gemini key can use Live Agent the same way a professional does. Optional cloud features may be introduced in the future, but the core tool stays free.

**Supported AI providers:**
| Provider | Models |
|---|---|
| OpenAI | GPT-5.5, GPT-5.5 Pro, GPT-5.4, GPT-5.4 mini, o3, o3 Pro |
| Anthropic | Claude Opus 4.8, Claude Sonnet 4.6, Claude Haiku 4.5 |
| Google | Gemini 3.5 Flash, Gemini 3.1 Pro (preview), Gemini 3.1 Flash-Lite |

Your API keys are stored locally in Live's extension storage and never leave your computer.

## Requirements

> **Note:** Live Agent is currently a developer preview — there is no packaged installer yet. You need to build from source.

**To run the extension:**

- **Ableton Live 12** version **12.4.5 beta** or later (any edition that supports Extensions)
- An API key from at least one AI provider:
  - [Google AI Studio](https://aistudio.google.com) — **free tier available**, no credit card required. Good starting point.
  - [OpenAI](https://platform.openai.com) — pay-as-you-go
  - [Anthropic](https://console.anthropic.com) — pay-as-you-go

**To build from source (additional):**

- **Node.js v24.16.0** (LTS) or higher — [download](https://nodejs.org)
- The Ableton Extensions SDK (see Setup below)

## Setup

### 1. Install dependencies

```bash
cd live-agent
npm install
```

### 2. Install the Ableton Extensions SDK

Download the SDK package from the [Ableton beta program](https://ableton.github.io/extensions-sdk/), then install it locally:

```bash
npm install /path/to/extensions-sdk-x.x.x/package
```

### 3. (Optional) Regenerate tools

The generated tool schemas and executor are already committed. If you update the SDK and want to pick up new API surface:

```bash
npm run generate
```

This re-parses the SDK types and rewrites `src/agent/generated-tools.ts` and `src/live/generated-executor.ts`.

### 4. Build

```bash
npm run build
```

### 5. Load in Live

- Open Live 12.4.5 beta
- Go to **Live → Preferences → Extensions**
- Enable **Developer Mode**
- Point Live to this project folder
- Run `npm start` — Live will connect to your extension and hot-reload on save

### 6. Add your API key

- Right-click any track → **Live Agent**
- Click the **gear icon** in the bottom control bar to open Settings
- Paste your API key for at least one provider
- Click the **chat icon** in the same bar to return and start talking

## UI

The chat webview opens in a **600×820 px** modal dialog (fixed size — the Extensions SDK does not support resizable or percentage-based dimensions).

Layout (top to bottom):

1. **Chat or Settings** — message list + input, or API key form
2. **Bottom control bar** — single row with provider/model selectors, debug and confirmation mode, diagnose/clear actions (chat only), and one **panel toggle** (gear ↔ chat icon)

The panel toggle swaps between chat and settings; chat-only controls hide while you are on Settings.

## Development

```bash
# Watch mode — recompiles on save, Live hot-reloads the extension
npm start

# Type-check only
npm run typecheck

# Regenerate tool schemas from SDK types
npm run generate
```

## Project structure

```
scripts/
└── generate-tools.ts     # Reads SDK types via ts-morph, writes generated-tools + generated-executor

src/
├── extension.ts          # Entry point — registers context menu, starts server, opens webview
├── server.ts             # Local HTTP + WebSocket server for chat streaming
├── storage.ts            # Persistent API key + settings storage (JSON file in Live's storage dir)
├── providers/
│   ├── index.ts          # ProviderAdapter interface + factory
│   ├── openai.ts         # OpenAI streaming adapter
│   ├── anthropic.ts      # Anthropic streaming adapter
│   └── gemini.ts         # Google Gemini adapter
├── agent/
│   ├── chat.ts           # System prompt builder
│   ├── tools.ts          # Custom tool schemas (get_live_state)
│   └── generated-tools.ts  # Auto-generated SDK tool schemas (do not edit)
├── live/
│   ├── executor.ts       # Custom tool handler (get_live_state)
│   └── generated-executor.ts  # Auto-generated SDK dispatcher (do not edit)
ui/src/                  # React + Vite webview (built to dist/ui/)
├── App.tsx               # Root layout — content area + bottom control bar
├── appTab.ts             # Chat ↔ settings toggle helpers
├── chatReducer.ts        # Chat message state machine
└── components/           # ChatPanel, ProviderBar (bottom controls), SettingsPanel, …
```

## Roadmap

> **Note:** This roadmap is provisional. The project is in private development — strategy and priorities will be revisited before any public release.
>
> Current state: `0.1.0-alpha` — untested, developer-only, not publicly released.

**v1 — Developer release**

- [ ] Confirmation mode — ask before destructive actions (delete track, clear clip)
- [ ] Autopilot mode — suppress confirmations, chain multiple actions without interruption
- [ ] Checkpoint system — snapshot Live Set before agent operations, restore any point
- [ ] Conversation persistence — save and restore history across Live restarts

**v2 — Power features**

- [ ] Consumer edition — packaged installer, managed auth, zero technical setup for non-developer musicians
- [ ] Producer rules — persistent per-session or global agent instructions ("always 4/4", "prefix track names with section")
- [ ] Rich context — @track / @clip / @device targeting in the chat
- [ ] Local model support — Ollama and other local LLMs, no API key required
- [ ] SDK auto-sync — CI step to regenerate tool schemas on each SDK release (requires Ableton to publish the SDK to a public registry)

**v3 — Platform**

- [ ] Cloud sync — conversation history and rules across machines
- [ ] Collaborative sessions — shared agent context for remote co-production

## License

**Apache 2.0 with Commons Clause**

Free to use, modify, and distribute for personal and non-commercial use. You may not sell the software or offer it as a hosted service without a separate commercial license from the author.

See [LICENSE](./LICENSE) for the full terms.
