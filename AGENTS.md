# Repository instructions

## Scope and structure

- Supply `@oardi/csv` directly from GitHub, pinned to a release tag or full commit hash. Keep `private: true`; do not configure an npm publication or automated releases.
- Keep the package focused on `Csv`, `CsvParseError`, and the associated import types. Preserve the extracted behavior unless asked to change it.
- Keep source in `src/`, tests in `tests/`, and build/package checks in `scripts/`.
- Keep Papa Parse, its public type definitions, and `@oardi/ts-types` as direct dependencies. Do not require consumers to install peers separately.
- Prefer `Dictionary`, `Nullable`, and `Optional` from `@oardi/ts-types`. Use `import type` for type-only imports and relative `.js` imports within the library.
- Compile JavaScript and declarations into ignored `dist/`. The ESM entry must forward to the CommonJS implementation so both formats share class identity.
- Keep `prepare` building the package for GitHub installs.

## Changes and validation

- Inspect the working tree before editing and preserve unrelated changes.
- Test through the public package name without path aliases. Keep TypeScript contracts strict and explain each `@ts-expect-error`.
- Run `npm ci` when setting up the checkout and `npm run validate` after changes. CI must run the same commands.
- Validation covers the build, ESM/CommonJS types, Node/browser behavior, packed-consumer installation with dependencies, and formatting.
- Document behavior, GitHub installs, migration, development, and releases in `readme.md`. Do not claim remote installation or CI passed without running them.

## Versions and Git

- Keep `package.json`, both root version fields in `package-lock.json`, and the dated release entry in `changelog.md` consistent.
- Tags use `v<version>` and point to the commit with matching release files.
- Create commits or tags, push, or publish only on explicit user instruction.
