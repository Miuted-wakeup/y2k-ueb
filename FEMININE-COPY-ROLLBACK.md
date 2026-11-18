# Reversible feminine presentation

This change presents Muted as a girl, uses feminine personal wording across the site, and adds `(muteada)` to profile display names. It includes the earlier HOME edits in the same dedicated commit.

## Restore the prior presentation
Only restore when explicitly requested by the user. Locate the commit titled `feat: use reversible feminine presentation across all sections` and revert that commit with `git revert <commit-sha>`. This restores the pre-change HOME and other sections together. Inspect the current diff and preserve unrelated work; resolve any conflicts narrowly if later edits overlap these text changes. Do not use a hard reset or force push.

The earlier HOME-only snapshot outside this repository is historical, not a complete rollback of this site-wide change. Prefer this commit for the full rollback.

## Scope
- Profile names: `MUTED (muteada)` / `muted (muteada)`.
- Feminine greetings, moods, obsessions, personal descriptions and dialogue.
- Shared daily diary wording applies consistently to all sections.
- Vocal ranges and technical classifications are unchanged: gender does not determine vocal range.
- No asset, account handle, URL, storage key, styling or audio changes.
- Tests were not requested and were not run.
