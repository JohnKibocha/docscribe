# DocScribe

**Turn six hours of clinical charting into six minutes of conversation.**

A 100% private, on-device clinical documentation assistant powered by Chrome's built-in AI.

## Status

**In Development**

## Quick Links

- **Demo:** Coming soon
- **Video:** Coming soon
- **Documentation:** [GitHub Wiki](https://github.com/yourusername/docscribe/wiki)

## Description

DocScribe uses Chrome's built-in Prompt API and Translator API to transcribe medical dictations into structured clinical notes, all processed locally on your device with zero cloud dependencies.

### Key Features

- Voice-to-text transcription with medical terminology understanding
- Structured output (SOAP, Progress, Discharge notes)
- Multi-format export (.docx, .pdf, .json, .csv, .html, .txt)
- Multi-language patient summaries (15+ languages)
- 100% private and offline-capable
- No subscriptions, no cloud processing, no HIPAA complications

## Technical Stack

- **Framework:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS + shadcn/ui
- **State:** Zustand with persistence
- **AI:** Chrome Prompt API (multimodal audio) + Translator API
- **Export:** jspdf, docx, papaparse, file-saver
- **Hosting:** Vercel

## Development Setup

### Prerequisites

- Node.js 18+
- pnpm
- Chrome Canary with AI flags enabled

### Installation

Clone repository
git clone https://github.com/JohnKibocha/docscribe.git
cd docscribe

Install dependencies
./run.sh install

Start development server
./run.sh dev

text

### Chrome AI Setup

1. Install [Chrome Canary](https://www.google.com/chrome/canary/)
2. Enable flags:
   - `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` → Enabled
   - `chrome://flags/#optimization-guide-on-device-model` → Enabled BypassPerfRequirement
3. Go to `chrome://components` and update "Optimization Guide On Device Model"
4. Restart Chrome Canary

See [docs/02_chrome_ai_setup.md](docs/02_chrome_ai_setup.md) for detailed instructions.

## Project Structure

```
docscribe/
├── src/
│ ├── components/ # React components
│ ├── hooks/ # Custom hooks
│ ├── services/ # AI and translation services
│ ├── store/ # Zustand state management
│ ├── types/ # TypeScript definitions
│ ├── utils/ # Helper functions
│ └── App.tsx
├── docs/ # Development documentation
├── public/ # Static assets
├── run.sh # Project automation script
└── README.md
```

## Documentation
- [Git Workflow](docs/00_git_workflow.md) - Branching and tagging strategy
- [Project Setup](docs/01_project_setup.md) - Initial setup documentation
- [Chrome AI Setup](docs/02_chrome_ai_setup.md) - AI configuration guide


## License

MIT License - see [LICENSE](LICENSE) file for details

## Author

John Kibocha 
Built for the Chrome AI Challenge 2025