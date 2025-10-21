# Git Workflow & Branching Strategy

**Created:** 2025-10-19  
**Last Updated:** 2025-10-19  
**Author:** John Kibocha

## Branch Structure

### main
- **Purpose:** Production-ready code only
- **Protection:** Never commit directly (except initial setup)
- **Deployment:** Auto-deploys to Vercel on push

### dev
- **Purpose:** Integration branch for completed features
- **Merges from:** Feature branches
- **Merges to:** main (via PR for final submission)

### Feature Branches
- **Naming:** `feat/descriptive-name`
- **Examples:**
  - `feat/voice-recording`
  - `feat/ai-transcription`
  - `feat/export-docx`
  - `feat/translator-integration`
- **Lifetime:** Created from dev, merged back to dev when complete

### Hotfix Branches
- **Naming:** `fix/descriptive-name`
- **Purpose:** Critical bugs found in main
- **Example:** `fix/json-parse-error`

## Commit Message Convention

**Format:** `type: description`

**Types:**
- `feat:` New feature implementation
- `fix:` Bug fix
- `docs:` Documentation updates
- `style:` Code formatting (no logic change)
- `refactor:` Code restructuring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

**Examples:**
```bash
git commit -m "feat: implement voice recording with MediaRecorder API"
git commit -m "feat: add Chrome Prompt API integration with multimodal audio"
git commit -m "fix: handle JSON parse errors in AI response"
git commit -m "docs: add Chrome AI setup guide"
git commit -m "refactor: extract export logic to separate helpers"
```

## Tagging Strategy

### Version Tags
- **Format:** `vX.Y.Z` (Semantic Versioning)
- **v0.1.0** - Initial project setup
- **v0.2.0** - Core AI transcription working
- **v0.3.0** - Export functionality complete
- **v0.4.0** - Polish and accessibility
- **v1.0.0** - Final submission (October 31, 2025)


### Milestone Tags
- **Format:** `milestone-name`
- **setup-complete** - Setup and foundations
- **core-ai-ui-complete** - Core AI and UI
- **core-features-complete** - Core features
- **enterprise-export-complete** - Enterprise export
- **polish-accessibility-complete** - Polish and accessibility
- **submission-ready** - Final tag before submission

**Creating Tags:**

```bash
# Lightweight tag
git tag v0.1.0

# Annotated tag (preferred for milestones)
git tag -a setup-complete -m "Setup and foundations complete"

# Push tags to remote
git push origin --tags
```

## Workflow Example

**Starting a new feature:**

```bash
git checkout dev
git pull origin dev
git checkout -b feat/voice-recording

# ... make changes ...
git add .
git commit -m "feat: implement voice recording hook"
git push origin feat/voice-recording
```


**Merging completed feature:**

```bash
git checkout dev
git merge feat/voice-recording
git push origin dev
git branch -d feat/voice-recording # Delete local branch
git push origin --delete feat/voice-recording # Delete remote branch
```

**Creating a release:**

```bash
git checkout main
git merge dev
git tag -a v1.0.0 -m "Final submission for Chrome AI Challenge 2025"
git push origin main --tags
```

## Emergency Rollback

**If main is broken:**
```bash
#Find last good commit
git log --oneline

Reset to that commit
git reset --hard <commit-hash>

Force push (use with caution)
git push origin main --force
```

## Notes

- Commit frequently (every completed subtask)
- Write descriptive commit messages
- Never commit console.log statements to main
- Tag every phase completion for easy rollback
- Keep dev branch stable (only merge tested features)