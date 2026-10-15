# Rebuno Dashboard

Web UI for [Rebuno](https://github.com/rebuno/rebuno), an open-source execution
runtime for production agents. Inspect executions, register agents, resolve
approvals, and watch kernel metrics.

Built with Next.js, React, and Tailwind CSS.

<p align="center">
  <img src="assets/execution.gif" width="900">
</p>

## Executions
![](assets/execution.png)

## Approvals
![](assets/approvals.png)

## Agents
![](assets/agents.png)


## Metrics
![](assets/metrics.png)

## Development

```bash
pnpm install
pnpm dev
```

Requires Node 24 and a running Rebuno kernel.

| Variable | Default | Purpose |
|----------|---------|---------|
| `REBUNO_URL` | `http://localhost:8080` | kernel base URL |
| `REBUNO_API_KEY` | none | bearer token for the kernel's client and admin routes without sign-in |
| `PROMETHEUS_URL` | none | metrics source; without it the metrics page reads the kernel's own counters |
| `OIDC_ISSUER` | none | identity provider issuer; turns on sign-in |
| `OIDC_CLIENT_ID` | none | the dashboard's client ID; required with `OIDC_ISSUER` |
| `OIDC_CLIENT_SECRET` | none | client secret; omit for a public client |
| `OIDC_SCOPES` | `openid email profile offline_access` | scopes requested at sign-in |
| `OIDC_FORWARD_TOKEN` | `id` | token forwarded to the kernel: `id` or `access` |
| `DASHBOARD_URL` | none | external URL for sign-in redirects; required with `OIDC_ISSUER` |
| `SESSION_SECRET` | none | at least 32 characters; encrypts the session cookie; required with `OIDC_ISSUER` |

See [Sign-in](https://github.com/rebuno/rebuno/blob/main/docs/dashboard.mdx#sign-in) for identity provider setup.

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start the dev server |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm test` | Run the test suite with Vitest |
| `pnpm typecheck` | Type-check with tsc |
| `pnpm lint` | Check formatting and lints with Biome |
| `pnpm format` | Apply Biome fixes |

## Documentation

[Dashboard](https://github.com/rebuno/rebuno/blob/main/docs/dashboard.mdx): what
each page does, how it reaches the kernel, and how to deploy it.

## License

[MIT](LICENSE)
