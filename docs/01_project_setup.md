# Project Setup Documentation

**Created:** 2025-10-19  
**Last Updated:** 2025-10-19

## Overview

This document captures the initial setup process for DocScribe, including project initialization, dependency installation, and repository configuration.

## Context

DocScribe is being built as a submission for the Google Chrome Built-in AI Challenge 2025. This setup phase establishes the foundation for rapid, structured development.

## Technical Stack Decisions

### Framework: Vite + React + TypeScript

**Why Vite:**
- Fastest HMR (Hot Module Replacement) available
- Optimized production builds
- Native ES modules support
- Zero configuration for React + TypeScript

**Why React 18:**
- Industry standard for component-based UIs
- Excellent TypeScript support
- Large ecosystem for medical/healthcare UIs

**Why TypeScript:**
- Required for enterprise-grade code quality
- Prevents runtime errors during judging
- Better IDE autocomplete for productivity

### Styling: Tailwind CSS + shadcn/ui

**Why Tailwind:**
- Utility-first CSS for rapid development
- Consistent design system
- Small bundle size (tree-shaken)

**Why shadcn/ui:**
- Pre-built, accessible components
- Fully customizable (owns the code)
- Professional medical UI aesthetic out of the box

### State Management: Zustand

**Why Zustand:**
- Minimal boilerplate compared to Redux
- Built-in persistence middleware for interruption recovery
- Easy to test and debug
- Perfect size for this project scope

## Installation Steps

### Step 1: WSL2/Git Configuration

**Purpose:** Prevent Windows/Linux filesystem conflicts.

```bash
git config --global core.autocrlf input
git config --global core.fileMode false
git config --global core.symlinks true
```

**Expected Output:**
No output means success.

**Troubleshooting:**
- If `git` command not found, install with: `sudo apt install git`

### Step 2: Project Initialization

```bash
pnpm create vite docscribe --template react-ts
cd docscribe
pnpm install
```

**Expected Output:**

```
Scaffolding project in /home/user/code/docscribe...
Done. Now run:

cd docscribe
pnpm install
pnpm run dev
```

**Troubleshooting:**
- If `pnpm` not installed: `npm install -g pnpm`
- If Node.js not installed: `nvm install 18` or `sudo apt install nodejs npm`

### Step 3: Tailwind CSS Setup

```bash
pnpm install -D tailwindcss postcss autoprefixer
pnpm tailwindcss init -p
```

**Configuration (tailwind.config.js):**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: "#0066CC",
                neutral: "#F8F9FA",
                card: "#FFFFFF",
                textPrimary: "#212529",
                textSecondary: "#6C757D",
                success: "#198754",
                error: "#DC3545"
            }
        }
    },
    plugins: []
};
```

**Add to src/styles/globals.css:**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Step 4: Repository Setup

```bash
git init
git remote add origin https://github.com/JohnKibocha/docscribe.git
git branch -M main
```

### Step 5: First Commit

```bash
git add .
git commit -m "first commit: initial project setup with Vite, React, and TypeScript"
git push -u origin main
```
## Automation Script

Created `run.sh` for common development tasks:

**Usage:**

```bash
./run.sh install # Install all dependencies
./run.sh dev # Start dev server
./run.sh build # Build for production
./run.sh stop # Stop all servers
./run.sh clean # Full cleanup
```
See `run.sh` file for complete implementation.

## Directory Structure

```bash
docscribe/
├── src/
│ ├── components/
│ │ ├── layout/ # AppShell, Header
│ │ ├── session/ # SessionManager, VersionHistory
│ │ ├── ui/ # shadcn/ui components
│ │ └── views/ # OutputTabs, StructuredView, etc.
│ ├── hooks/ # Custom React hooks
│ ├── services/ # AI and translation wrappers
│ ├── store/ # Zustand state management
│ ├── styles/ # Global CSS
│ ├── types/ # TypeScript interfaces
│ └── utils/ # Helper functions
├── docs/ # Development documentation
├── public/ # Static assets
└── run.sh # Automation script
```

## References

- [Vite Documentation](https://vitejs.dev/)
- [React 18 Documentation](https://react.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [Zustand Documentation](https://github.com/pmndrs/zustand)

## Notes

- All Git configurations are WSL2-specific to prevent CRLF issues
- Vite dev server runs on port 5173 by default
- Preview server runs on port 4173
- Using pnpm for faster installs and better monorepo support