# Live Agent

AI-powered assistant built into Ableton Live. Chat with GPT, Claude, or Gemini to control your session using natural language.

> "Create a MIDI track named Bass." → Done.

## What it does

Live Agent is an Ableton Extension that opens a chat panel inside Live. You type instructions in plain language and the agent executes them directly on your session using the Ableton Extensions SDK.

**Supported actions (MVP):**
- Create / rename / delete / duplicate tracks
- Create MIDI clips
- Set tempo
- Fire clips and scenes
- Read session state (tracks, BPM, time signature)

**Supported AI providers:**
| Provider | Models |
|---|---|
| OpenAI | GPT-4o, GPT-4o mini, GPT-4.1 mini, o3-mini |
| Anthropic | Claude Sonnet 4.5, Claude Opus 4.5, Claude Haiku 3.5 |
| Google | Gemini 2.5 Pro, Gemini 2.5 Flash |

Your API keys are stored locally in Live's extension storage and never leave your computer.

## Requirements

- **Ableton Live 12 Suite** version **12.4.5 beta** or later
- **Node.js v24.16.0** (LTS) or higher — [download](https://nodejs.org)
- **Ableton Extensions SDK** — download from [Centercode beta program](https://ableton.github.io/extensions-sdk/)
- At least one API key from OpenAI, Anthropic, or Google AI Studio

## Setup

### 1. Install the Ableton Extensions SDK

Join the beta program, download the SDK, and note the path to the SDK folder.

### 2. Install dependencies

```bash
cd live-agent
npm install
```

Then install the Ableton SDK package (path will vary by your download location):

```bash
npm install /path/to/ableton-extensions-sdk/package
```

### 3. Build

```bash
npm run build
```

### 4. Load in Live

- Open Live 12.4.5 beta
- Go to **Live → Extensions** in Settings
- Enable **Developer Mode**
- Point Live to this project folder
- Run `npm start` — Live will connect to your extension

### 5. Add your API key

- Right-click any track → **Open Live Agent**
- Switch to the **Settings** tab
- Paste your API key for at least one provider
- Switch back to **Chat** and start talking

## Development

```bash
# Watch mode (recompiles on save, Live hot-reloads)
npm start

# Type-check only
npm run typecheck
```

The extension host reloads automatically when files change — no need to restart Live.

## Project structure

```
src/
├── extension.ts          # Entry point — activate(), webview lifecycle, message routing
├── ableton-live.d.ts     # Type stubs for the SDK (replaced by real types on install)
├── providers/
│   ├── index.ts          # ProviderAdapter interface + factory
│   ├── openai.ts         # OpenAI streaming adapter
│   ├── anthropic.ts      # Anthropic streaming adapter
│   └── gemini.ts         # Google Gemini adapter
├── agent/
│   ├── chat.ts           # System prompt builder
│   └── tools.ts          # Ableton tool schemas for function calling
├── live/
│   └── executor.ts       # Maps tool calls → Ableton SDK calls
└── ui/
    └── index.html        # Self-contained chat + settings webview
```

## Roadmap

- [ ] Add notes to MIDI clips
- [ ] Warp mode control on audio clips
- [ ] Device/plugin parameter control
- [ ] Arrangement view actions
- [ ] Voice input
- [ ] Multi-turn memory / session persistence

## License

MIT
