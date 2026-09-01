# Contributing to the Rebuno Dashboard

Thanks for your interest in contributing. This guide covers how to set up the project locally and submit changes.

## Prerequisites

- **Node** 24 (what CI uses)
- **pnpm** (the version in `packageManager`)
- A running [Rebuno kernel](https://github.com/rebuno/rebuno) for the UI to talk to

## Getting Started

```bash
pnpm install
pnpm dev           # next dev
pnpm build         # production build
pnpm test          # vitest run
pnpm typecheck     # tsc --noEmit
pnpm lint          # biome check
pnpm format        # biome format --write
```

The dashboard proxies the kernel API through its own routes. Configure it with:

| Env | Default | Description |
|---|---|---|
| `REBUNO_URL` | `http://localhost:8080` | Kernel base URL. |
| `REBUNO_API_KEY` | — | Bearer token, if the kernel requires one. |
| `PROMETHEUS_URL` | — | Prometheus base URL. Unset falls back to scraping the kernel's `/metrics`, which gives current values but no history. |

## Submitting Changes

1. Fork the repo and create a branch from `main`.
2. Make your changes. Add tests for new functionality.
3. Run `pnpm format`, then make sure `pnpm test`, `pnpm typecheck`, and `pnpm lint` pass — CI runs those three plus `pnpm format:check`.
4. Open a pull request with a clear description of what changed and why.

## Reporting Issues

Open an issue on GitHub. Include:

- What you expected to happen
- What actually happened
- Steps to reproduce
- Relevant logs or error messages

## License

By submitting a contribution, you agree that it is licensed under the
[MIT License](LICENSE), the same terms that cover the rest of the project.
