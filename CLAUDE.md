# WrapX Project Rules

## Milestone merge history

For milestone feature branches such as M5, M6, and later milestone slices, prefer an explicit merge commit when integrating into `master`.

- Use `git merge --no-ff <milestone-branch>` when possible, even if the branch could fast-forward.
- Use a clear merge commit title such as `Merge M5 Windows alpha installer lane`.
- Keep feature development in dedicated worktrees/branches, then integrate the milestone branch into `master` with the explicit merge record.
- Do not rewrite existing published history just to retrofit missing merge commits unless the user explicitly asks for that.

Why: milestone merge commits make the project history easier to scan and preserve visible boundaries between M0/M1/M2/M3/M4/M5+ work.

## Chinese change descriptions

When describing changes for this project, use Chinese by default.

- Use Chinese for change summaries in final reports, PR descriptions, release notes, changelog entries, and merge/change explanations.
- If writing commit bodies or merge bodies that explain what changed, write those explanations in Chinese.
- Keep code identifiers, file paths, command names, package names, and existing project terms unchanged when translating them would reduce clarity.

## Real validation after changes

After modifying code, UI, configuration, or project documentation, run the narrowest relevant real validation before reporting completion.

- For UI/runtime changes, open the real Tauri window and verify the affected behavior visually or interactively; screenshots are preferred for layout-sensitive changes.
- For frontend changes, run the relevant build/type validation such as `npm run build`.
- For Rust/Tauri changes, run the relevant Rust validation such as `cargo check --manifest-path src-tauri/Cargo.toml`.
- If real validation cannot be run, report exactly what was not validated and why.
