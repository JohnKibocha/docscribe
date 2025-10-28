```
git ls-files -z --cached --others --exclude-standard | xargs -0 -n 1000 ls -lRt
```

docscribe/
├── .gitignore
├── LICENSE
├── README.md
├── docs/
│   ├── .gitkeep
│   ├── 00_git_workflow.md
│   ├── 01_project_setup.md
│   ├── 02_chrome_ai_setup.md
│   ├── 03_architecture.md
│   ├── 04_translation_implementation.md
│   ├── 05_performance_improvements.md
│   ├── 06_stability_fixes_summary.md
│   ├── 06_surgical_prompt_enhancements.md
│   ├── 07_contextual_medical_correction.md
│   └── 08_aiworker_complete_synchronization.md
├── eslint.config.js
├── index.html
├── package.json
├── pnpm-lock.yaml
├── public/
│   └── vite.svg
├── run.sh
├── src/
│   ├── App.css
│   ├── App.tsx
│   ├── assets/
│   │   └── react.svg
│   ├── components/
│   │   ├── AccuracyDisclaimer.tsx
│   │   ├── ChromeAISetup.tsx
│   │   ├── LanguageSelector.tsx
│   │   ├── MedicalNoteEditor.tsx
│   │   ├── VoiceDictation.tsx
│   │   ├── layout/
│   │   ├── session/
│   │   ├── ui/
│   │   │   ├── button.tsx
│   │   │   ├── Select.tsx
│   │   │   └── Toaster.tsx
│   │   └── views/
│   │       └── OutputTabs.tsx
│   ├── hooks/
│   │   ├── use-toast.ts
│   │   └── useVoiceRecorder.ts
│   ├── index.css
│   ├── lib/
│   │   └── utils.ts
│   ├── main.tsx
│   ├── services/
│   │   ├── audioArchive.ts
│   │   ├── chromeAI.ts
│   │   ├── mainThreadAI.ts
│   │   ├── translator.ts
│   │   └── webSpeechAPI.ts
│   ├── store/
│   │   └── sessionStore.ts
│   ├── styles/
│   ├── types/
│   │   ├── chrome-ai.d.ts
│   │   ├── chrome-translator.d.ts
│   │   └── index.ts
│   ├── utils/
│   │   ├── download-gemini-nano.html
│   │   ├── jsonParser.ts
│   │   └── logger.ts
│   └── workers/
│       └── aiWorker.ts
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```
