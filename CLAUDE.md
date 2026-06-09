# WrapX Project Rules

## Milestone merge history

For milestone feature branches such as M5, M6, and later milestone slices, prefer an explicit merge commit when integrating into `master`.

- Use `git merge --no-ff <milestone-branch>` when possible, even if the branch could fast-forward.
- Use a clear merge commit title such as `Merge M5 Windows alpha installer lane`.
- Keep feature development in dedicated worktrees/branches, then integrate the milestone branch into `master` with the explicit merge record.
- Do not rewrite existing published history just to retrofit missing merge commits unless the user explicitly asks for that.

Why: milestone merge commits make the project history easier to scan and preserve visible boundaries between M0/M1/M2/M3/M4/M5+ work.
