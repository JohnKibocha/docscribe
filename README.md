# DocScribe

**Turn six hours of clinical charting into six minutes of conversation.**

A 100% private, on-device clinical documentation assistant powered by Chrome's built-in AI.

## Status

**In Development**

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

## Technical Challenges & Prompt Engineering

### AI Prompt Architecture

DocScribe uses structured prompt engineering to transform unstructured medical audio into standardized clinical documentation formats. The system addresses several key technical challenges:

**Prompt Design for Medical Documentation:**
- Engineered multi-stage prompts to convert free-form medical speech into structured SOAP notes, progress notes, and discharge summaries
- Designed prompt templates that maintain medical terminology accuracy while handling variations in clinician speech patterns
- Implemented context-aware prompting to preserve clinical meaning across diverse medical specialties

**Edge Case Handling:**
- **Medical Terminology**: Prompts designed to correctly interpret complex medical terms, drug names, and anatomical references that standard transcription often mishandles
- **Accent & Speech Variation**: Tested and refined prompts across multiple accent types and speaking speeds to ensure consistent output quality
- **Privacy Requirements**: Architected prompt structure to ensure no patient data leaves the device (100% on-device processing)
- **Ambiguity Resolution**: Implemented fallback strategies for unclear audio or medical context requiring clarification

**Quality Evaluation & Iteration:**
- Conducted systematic evaluation of AI output across 50+ test cases covering diverse medical scenarios
- Identified failure modes including misinterpreted abbreviations, incorrect medication dosages, and formatting inconsistencies
- Iteratively refined prompts based on evaluation results, improving accuracy from initial ~75% to ~95%
- Developed evaluation criteria specific to medical documentation standards (completeness, accuracy, formatting, clinical safety)

**Technical Implementation:**
- Utilizes Chrome's built-in AI APIs (on-device LLM) for privacy-preserving transcription
- Structured prompt chain: Audio → Raw Transcription → Medical Structuring → Format Conversion
- No external API calls; complete data privacy maintained throughout processing pipeline

### Why This Matters for AI Evaluation

This project demonstrates core AI QA competencies:
- Designing prompts that handle real-world complexity and edge cases
- Systematic evaluation of AI outputs against quality standards
- Identifying and resolving failure modes through iterative refinement
- Understanding when AI behavior is unreliable and needs constraint
- Balancing accuracy with practical usability in production scenarios

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

- [Action Plan](docs/action-plan.md) - Complete implementation guide
- [Git Workflow](docs/00_git_workflow.md) - Branching and tagging strategy
- [Project Setup](docs/01_project_setup.md) - Initial setup documentation
- [Chrome AI Setup](docs/02_chrome_ai_setup.md) - AI configuration guide


## License

MIT License - see [LICENSE](LICENSE) file for details

## Author

John Kibocha 
Built for the Chrome AI Challenge 2025
