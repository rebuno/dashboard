# Rebuno Dashboard

Web UI for [Rebuno](https://github.com/rebuno/rebuno) — view executions, steps, events, and agent activity.

Built with Next.js, React, and Tailwind CSS.

## Development

```bash
npm install
npm run dev
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
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Type-check with tsc |
