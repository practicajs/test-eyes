# Implementation Tasks

## Step 1: Build and publish reporter
- [x] Create `collectors/playwright-reporter/` structure
- [x] Implement Reporter interface (onBegin, onTestEnd, onEnd)
- [x] Add flaky detection (wasFlaky field)
- [x] Add git operations (commit, push to gh-data)
- [x] Add aggregation logic
- [x] Publish to npm as `@practica/test-eyes`

## Step 2: Verify from external repo
- [x] Create test-eyes-demo repo
- [x] Add slow test (1.5s delay)
- [x] Add flaky test (50% random failure)
- [x] Install and configure @practica/test-eyes
- [x] Run tests 3-5 times
- [x] Verify dashboard shows correct data

## Step 3: Bug fixes
- [x] Fix test name prefix (` >  > ` issue)
- [x] Fix filename overwrite (add timestamp)

## Remaining
- [ ] Dashboard auto-deploy for external repos
- [ ] JUnit backward compatibility verification
- [ ] PR merge to main
