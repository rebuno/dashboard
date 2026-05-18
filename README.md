# Rebuno Dashboard

Web UI for [Rebuno](https://github.com/rebuno/rebuno) — view executions, steps, events, and agent activity.

Built with Next.js, React, and Tailwind CSS.

## Development

```bash
pnpm install
pnpm dev
```

Requires a running Rebuno kernel. Set `KERNEL_URL` (defaults to `http://localhost:8080`).

## Docker

```bash
docker compose -f deploy/docker-compose.yaml up
```

The dashboard connects to the kernel via the shared `rebuno` network. Start the kernel first so the network exists.

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Type-check with tsc |
