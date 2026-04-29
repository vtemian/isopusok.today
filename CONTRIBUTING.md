# Contributing to isopusok.today

Thanks for your interest! This is a small project — bug reports, design tweaks,
and copy fixes are all welcome.

## Getting started

```sh
make dev          # installs deps, applies local D1 migrations, runs the worker
```

Open <http://127.0.0.1:8787>. See [`README.md`](README.md) for the full local
setup.

## Before submitting a PR

1. `npm run typecheck` — must be clean.
2. `npm test` — all tests must pass. The harness applies
   `migrations/0001_init.sql` to an in-memory D1 before each file (no mocks).
3. Test your change in a browser too — type-checks don't catch UI regressions.

## Code style

- Match the surrounding code. Vanilla TS on the server, vanilla DOM APIs on the
  client. No frameworks, no bundler.
- The page is server-rendered as a single TS string in `src/page.ts`. Inline JS
  uses `textContent` / `replaceChildren` only — never `innerHTML`.
- Keep changes small and focused. One concern per PR.

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation
- `chore:` maintenance / tooling
- `refactor:` no behaviour change

## Pull requests

1. Fork, branch from `main`.
2. Make the change, run typecheck + tests, commit.
3. Open a PR against `main`.

CI runs typecheck and tests on every PR. A push to `main` deploys to
[isopusok.today](https://isopusok.today) automatically.

## License

By contributing, you agree that your contributions will be licensed under the
MIT License.
