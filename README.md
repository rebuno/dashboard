# Rebuno Dashboard

Web UI for [Rebuno](https://github.com/rebuno/rebuno) — view executions, steps, events, and agent activity.

Built with Next.js, React, and Tailwind CSS.

## Development

```bash
pnpm install
pnpm dev
```

Requires a running Rebuno kernel. Set `REBUNO_URL` (defaults to `http://localhost:8080`).

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Type-check with tsc |
