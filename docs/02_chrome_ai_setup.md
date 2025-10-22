# Chrome AI Setup Guide

**Created:** 2025-10-21  
**Last Updated:** 2025-10-21  
**Author:** John Kibocha

## Overview

This document provides step-by-step instructions for configuring Chrome Canary to enable the built-in AI APIs required by DocScribe. Following this guide ensures you have a properly configured environment for developing and testing the medical documentation assistant.

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Install Chrome Canary](#install-chrome-canary)
3. [Verify Chrome Version](#verify-chrome-version)
4. [Enable Required Flags](#enable-required-flags)
5. [Enable Internal Debugging](#enable-internal-debugging)
6. [Download Gemini Nano Model](#download-gemini-nano-model)
7. [Verify Installation](#verify-installation)
8. [Troubleshooting](#troubleshooting)

## System Requirements

Before proceeding, ensure your system meets these minimum requirements:

**Operating System:**
- Windows 10 or 11
- macOS 13+ (Ventura and onwards)
- Linux (Ubuntu 20.04+, Fedora 35+, or equivalent)
- ChromeOS on Chromebook Plus devices (Platform 16389.0.0+)

**Hardware:**
- Storage: At least 22 GB of free disk space
- GPU: Strictly more than 4 GB of VRAM (recommended)
- CPU: 16 GB RAM and 4+ CPU cores (if using CPU mode)
- Network: Unmetered connection for initial model download

**Browser:**
- Chrome Canary 143+ or Chrome Dev 140+

**IMPORTANT:** Gemini Nano is NOT available on mobile devices (Android, iOS).

## Install Chrome Canary

Chrome Canary is the bleeding-edge development version of Chrome with experimental features.

### Download Chrome Canary

1. Navigate to the official download page: https://www.google.com/chrome/canary/
2. Download the installer for your operating system
3. Run the installer and follow the on-screen instructions
4. Launch Chrome Canary after installation completes

**NOTE:** Chrome Canary can run alongside your stable Chrome installation without conflicts.

### Why Canary?

Chrome Canary receives daily updates and includes experimental APIs before they reach stable Chrome. The Prompt API with multimodal input is currently only available in Canary and Dev channels.

## Verify Chrome Version

After installing Chrome Canary, confirm you have the correct version:

### Step 1: Check Version

1. Open Chrome Canary
2. Navigate to `chrome://version/`
3. Verify the version number is **143.0.7484.0 or higher**
4. Note the user data directory path (needed for troubleshooting)

### Step 2: Update if Necessary

If your version is older than 143:

1. Go to `chrome://settings/help`
2. Chrome will automatically check for updates
3. Click "Relaunch" if an update is available
4. After relaunch, verify the new version at `chrome://version/`

**TIP:** Chrome Canary updates automatically every day. If you encounter issues, try updating to the latest version first.

## Enable Required Flags

Chrome flags enable experimental features that are not yet available by default. DocScribe requires several AI-related flags.

### Step 1: Navigate to Flags Page

1. Open Chrome Canary
2. Type `chrome://flags/` in the address bar and press Enter
3. You will see the Experiments page

### Step 2: Enable Core AI Flags

Search for and enable the following flags (use the search box at the top):

#### 1. Prompt API for Gemini Nano

**Flag:** `chrome://flags/#prompt-api-for-gemini-nano`

- Set to: **Enabled Multilingual**
- Purpose: Enables the base Prompt API with support for English, Spanish, and Japanese

#### 2. Prompt API with Multimodal Input

**Flag:** `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`

- Set to: **Enabled**
- Purpose: Extends Prompt API to accept audio and image inputs (critical for voice recording)

#### 3. Optimization Guide On Device Model

**Flag:** `chrome://flags/#optimization-guide-on-device-model`

- Set to: **Enabled BypassPerfRequirement**
- Purpose: Allows model download even on lower-spec devices

### Step 3: Enable Additional AI APIs (Optional but Recommended)

These flags enable specialized AI APIs that may be useful for future features:

#### 4. Summarization API

**Flag:** `chrome://flags/#summarization-api-for-gemini-nano`

- Set to: **Enabled Multilingual**
- Purpose: Enables text summarization capabilities

#### 5. Writer API

**Flag:** `chrome://flags/#writer-api-for-gemini-nano`

- Set to: **Enabled Multilingual**
- Purpose: Enables AI-assisted writing features

#### 6. Rewriter API

**Flag:** `chrome://flags/#rewriter-api-for-gemini-nano`

- Set to: **Enabled Multilingual**
- Purpose: Enables text rewriting and rephrasing

#### 7. Proofreader API

**Flag:** `chrome://flags/#proofreader-api-for-gemini-nano`

- Set to: **Enabled**
- Purpose: Enables grammar and spelling correction

#### 8. Experimental translation API

**Flag:** `chrome://flags/#translation-api`

- Set to: **Enabled without language pack limit**
- Purpose: Enables the on-device language translation API. See https://github.com/WICG/translation-api/blob/main/README.md – Mac, Windows, Linux

#### 9. Translation API streaming split by sentence

**Flag:** `chrome://flags/#translation-api-streaming-by-sentence`

- Set to: **Enabled**
- Purpose: Enables sentence-split streaming for on-device translation API. – Mac, Windows, Linux

### Step 4: Relaunch Chrome

After enabling all flags:

1. A blue "Relaunch" button will appear at the bottom of the page
2. Click **Relaunch** to restart Chrome Canary
3. **CRITICAL:** Do NOT just close and reopen Chrome. You MUST use the Relaunch button for flags to take effect.

### Verification

After relaunch, verify flags are active:

1. Navigate back to `chrome://flags/`
2. Search for each flag you enabled
3. Confirm they show as "Enabled" or "Enabled Multilingual"

## Enable Internal Debugging

Chrome's on-device internals page provides detailed information about AI model status and allows debugging.

### Step 1: Navigate to Internals Page

1. Type `chrome://on-device-internals/` in the address bar
2. Press Enter

### Step 2: Understand the Interface

The internals page has three tabs:

**Tools Tab:**
- Provides manual controls for model management
- Use for forcing model downloads or resets

**Event Logs Tab:**
- Shows real-time logs of AI API activity
- Critical for debugging API errors
- Logs include timestamps, error codes, and stack traces

**Model Status Tab:**
- Displays current status of installed models
- Shows model version, backend type (GPU/CPU), and file size
- Displays foundational model criteria (device capability, disk space, etc.)

### Step 3: Check Model Status

1. Click the **Model Status** tab
2. Look for the "Foundational Model" section
3. Note the current state (this will initially show as not installed)

**Foundational Model Criteria Table:**
- `device capable`: Should be `true`
- `disk space available`: Should be `true`
- `enabled by enterprise policy`: Should be `true`
- `enabled by feature`: Should be `true`

If any criteria show `false`, refer to the Troubleshooting section.

## Download Gemini Nano Model

The Gemini Nano language model (approximately 4 GB) must be downloaded before DocScribe can function.

### Step 1: Locate the Download Utility

The project includes a custom download utility for user-friendly model installation:

```
utils/download-gemini-nano.html
```

### Step 2: Open the Utility

**Method 1: Direct File Open**
1. Open File Explorer (Windows) or Finder (macOS)
2. Navigate to your DocScribe project directory
3. Open the `utils` folder
4. Double-click `download-gemini-nano.html`
5. The file will open in your default browser

**Method 2: Drag and Drop**
1. Open Chrome Canary
2. Drag `download-gemini-nano.html` from File Explorer/Finder into the browser window
3. The utility will load

**Method 3: File URL**
1. Open Chrome Canary
2. Press `Ctrl+O` (Windows/Linux) or `Cmd+O` (macOS)
3. Navigate to and select `download-gemini-nano.html`
4. Click Open

### Step 3: Use the Download Utility

The utility interface displays:

**Status Card:**
- Shows current model availability status
- Updates in real-time during download

**Download Button:**
- Click to initiate model download
- Button will be disabled if model is already installed or device is unsupported

**Progress Bar:**
- Displays download progress from 0-100%
- Shows indeterminate progress during extraction phase

**System Requirements Section:**
- Lists minimum requirements for reference

### Step 4: Initiate Download

1. Click the **"Start Download"** button
2. The download will begin immediately (no additional prompts)
3. Progress updates will appear in real-time

**Download Phases:**

**Phase 1: Download (0-100%)**
- Downloads approximately 4 GB of model data
- Takes 10-30 minutes depending on connection speed
- Progress bar shows exact percentage

**Phase 2: Extraction**
- Extracts and validates model files
- Takes 2-5 minutes
- Progress bar shows indeterminate animation

**Phase 3: Initialization**
- Loads model into memory
- Takes 30-60 seconds
- Status changes to "Model ready"

### Step 5: Monitor Progress

While downloading, you can monitor detailed progress:

1. Open a new tab
2. Navigate to `chrome://on-device-internals/`
3. Select the **Event Logs** tab
4. Watch real-time log entries for download events

**IMPORTANT:** Do NOT close Chrome Canary during download. Closing the browser will cancel the download and you will need to restart.

### Step 6: Confirm Success

After download completes:

1. The utility will display a success message: "Gemini Nano downloaded successfully"
2. The button will change to "Download Complete" and be disabled
3. Navigate to `chrome://on-device-internals/` > Model Status tab
4. Confirm the following:
	- **Foundational model state:** `Ready`
	- **Model Name:** `v3Nano`
	- **Version:** Should show a date-based version (e.g., `2025.06.30.1229`)
	- **Backend Type:** `GPU (highest quality)` or `CPU`
	- **Folder size:** Approximately 4,072 MiB (4 GB)

## Verify Installation

After completing all setup steps, verify everything works correctly.

### Test 1: Check API Availability

1. Open Chrome Canary
2. Press `F12` to open DevTools
3. Go to the **Console** tab
4. Run this command:

```
await LanguageModel.availability();
```

**Expected Output:** `"available"`

If you see `"unavailable"`, `"downloadable"`, or an error, refer to Troubleshooting.

### Test 2: Create a Session

Still in the DevTools console, run:

```
const session = await LanguageModel.create({ outputLanguage: 'en' });
```

**Expected Output:** No error. The command should complete silently.

### Test 3: Send a Test Prompt

```
const result = await session.prompt('Say hello in one sentence.');
console.log(result);
```

**Expected Output:** A friendly greeting from the AI (e.g., "Hello there!").

### Test 4: Clean Up

```
await session.destroy();
```

**Expected Output:** No error.

### Final Verification Checklist

- [ ] Chrome Canary version 143+
- [ ] All required flags enabled and relaunched
- [ ] `chrome://on-device-internals/` shows "Ready" state
- [ ] Model size is approximately 4 GB
- [ ] `LanguageModel.availability()` returns `"available"`
- [ ] Test prompt returns a valid response
- [ ] No errors in DevTools console

If all items are checked, your Chrome AI setup is complete and DocScribe can be developed.

## Troubleshooting

### Issue: LanguageModel is Undefined

**Symptoms:**
```
await LanguageModel.availability();
// Error: LanguageModel is not defined
```

**Solutions:**
1. Verify flags are enabled at `chrome://flags/`
2. Ensure you clicked "Relaunch" after enabling flags (not just close/reopen)
3. Check Chrome version is 143+ at `chrome://version/`
4. Try restarting your computer (clears browser cache)

### Issue: Availability Returns "unavailable"

**Symptoms:**
```
await LanguageModel.availability();
// Returns: "unavailable"
```

**Solutions:**
1. Check system requirements (disk space, GPU/RAM)
2. Go to `chrome://on-device-internals/` > Model Status
3. Check "Foundational model criteria" table for `false` values
4. If `disk space available` is `false`, free up at least 22 GB
5. If `device capable` is `false`, your hardware does not meet requirements

### Issue: Model Stuck at "downloadable"

**Symptoms:**
- `LanguageModel.availability()` returns `"downloadable"`
- Clicking download button does nothing
- Model never starts downloading

**Solutions:**
1. Ensure you have an unmetered network connection (not cellular data)
2. Check Windows "Set as metered connection" setting is OFF
3. Try using the download utility (`utils/download-gemini-nano.html`)
4. Verify you have 22+ GB free disk space
5. Check `chrome://on-device-internals/` > Event Logs for error messages

### Issue: Download Stuck at 10%

**Symptoms:**
- Progress bar stops moving at 10% or another percentage
- No error messages displayed

**Solutions:**
1. This is often normal - large chunks download at once
2. Wait 5-10 minutes before assuming it's stuck
3. Check `chrome://on-device-internals/` > Event Logs for activity
4. If truly stuck for >30 minutes, refresh the page and restart download
5. Check your network connection is stable

### Issue: "Model crash count" Greater Than 0

**Symptoms:**
- `chrome://on-device-internals/` shows "Model crash count (current/maximum): 1/3" or higher

**Solutions:**
1. Update GPU drivers to the latest version
2. Go to `chrome://flags/#optimization-guide-on-device-model`
3. Try changing backend type (GPU to CPU or vice versa)
4. Check Event Logs tab for crash details
5. File a Chromium bug report with crash logs

### Issue: Model Works but Responses are Poor Quality

**Symptoms:**
- Model returns very short or incoherent responses
- Ignores system prompts or instructions

**Solutions:**
1. Check `chrome://on-device-internals/` > Model Status for backend type
2. If showing "CPU (lower quality)", consider upgrading GPU
3. Ensure model version is recent (check for Chrome updates)
4. Try clearing and re-downloading the model
5. Refine your system prompt to be more explicit

### Issue: APIs Work in Console but Not in Code

**Symptoms:**
- DevTools console tests pass
- Application code throws errors or returns `undefined`

**Solutions:**
1. Ensure you're not using `window.ai` (old API, no longer supported)
2. Use `LanguageModel` directly, not `ai.languageModel`
3. Check your code is running after page load (use `DOMContentLoaded`)
4. Verify you're testing in a regular tab, not incognito mode
5. Add `try/catch` blocks to see detailed error messages

### Getting Help

If you continue to experience issues:

1. Check the official docs: https://developer.chrome.com/docs/ai/get-started
2. Search the Chromium AI discussion group: https://groups.google.com/a/chromium.org/g/chrome-ai-dev-preview-discuss
3. File a bug report: https://issues.chromium.org/issues/new?component=1583300
4. Include logs from `chrome://on-device-internals/` > Event Logs tab

## Additional Resources

**Official Documentation:**
- Chrome AI Overview: https://developer.chrome.com/docs/ai/built-in-apis
- Prompt API Guide: https://developer.chrome.com/docs/ai/prompt-api
- Get Started Guide: https://developer.chrome.com/docs/ai/get-started

**Community Resources:**
- Chrome AI Discussion Group: https://groups.google.com/a/chromium.org/g/chrome-ai-dev-preview-discuss
- GitHub Examples: https://github.com/GoogleChrome/chrome-extensions-samples

**DocScribe Internal Documentation:**
- Project Setup: `docs/01_project_setup.md`
- Architecture Overview: `docs/03_architecture.md`

## Changelog

**2025-10-21:** Initial version based on Chrome Canary 143.0.7484.0 setup process

## Notes

- This guide is specific to Chrome Canary 143+. Future versions may change the API or flag names.
- Screenshots of enabled flags are available in the project repository.
- The download utility (`utils/download-gemini-nano.html`) is maintained separately and may receive updates.
- Always check for Chrome updates before reporting issues, as the API is rapidly evolving.
