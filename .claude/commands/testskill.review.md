---
description: 'Review a test file against testing best practices'
---

## UX Prerequisites

1. Read `.cursor/skills/frontend-testing/skill-ux-and-behaviour.md` and follow its communication guidelines throughout this command

## What This Does

Reviews a test against all testing best practices and mutation testing, then produces a visual report

## Arguments

- `$ARGUMENTS` (required): Test file path OR specific test title
- `review_depth` (optional, default `normal`): `normal` | `comprehensive`

## Validation

If no argument provided, stop and print an error:

> Please provide a test file path or test title. Example: `/testskill.review src/pages/Teams/test/Teams.test.tsx`

## Instructions

1. Determine inputs: Parse `$ARGUMENTS` to extract `test_title` and/or `test_file_path`

2. Invoke `testskill.reviewer` with:
   - `tests`: `[{ "title": "{test_title}", "file_path": "{test_file_path}" }]`
   - `review_depth`: from `$ARGUMENTS` if provided, otherwise `normal`

3. Only if review_depth is set to 'comprehensive', invoke `testskill.mutator` with:
   - `test_title`: the test title from arguments
   - `test_file_path`: the file path (if provided)

4. Extract the first element from the reviewer's JSON array. Render beautiful visual output including emojis (mandatory) from the reviewer and mutator responses:

```
## Test Review: {filename}

### Summary (include emojis and keep the formatting rigidly)
🔁 Stability {passes}/{runs} passed (comprehensive only, skip if null)
📊 {total_checked} best practices checked
✅ {followed} best practices followed
❌ {violated} violations found
➖ {not_applicable} rules not applicable
🧬 Mutation Detection {caught}/{total} ({percentage}%)
📈/📉 Coverage {change}% (comprehensive only, skip if null)

### Violations

| Lines | Rule | Issue | Suggested Fix |
|-------|------|-------|---------------|
| {lines} | {rule_id} {principle_name} | {issue} | {suggested_fix} |

### Mutation Results

| # | Mutation | Result |
|---|----------|--------|
| 1 | {mutation} | ✅ CAUGHT / 🔴 SURVIVED |
```

If no violations found, congratulate the test author