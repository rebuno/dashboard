# Working on the Rebuno Dashboard

This repository contains the Next.js App Router dashboard for inspecting
executions, managing agents and policies, resolving approvals, and viewing
metrics. The Go kernel owns execution state and policy enforcement. Read
[CONTRIBUTING.md](CONTRIBUTING.md) for the contribution workflow.

## Repository map

| Path | Responsibility |
| --- | --- |
| `app/` | Page routes, layouts, global styles, and server route handlers. |
| `app/api/v0/[...path]/route.ts` | Server proxy from `/api/v0/` to the kernel's `/v0/` API. |
| `app/api/metrics/query/route.ts` | Prometheus queries and direct kernel metrics fallback. |
| `components/executions/`, `components/agents/`, `components/approvals/`, `components/metrics/` | Feature views and controls. |
| `components/` | Shared sidebar, theme toggle, status badges, and JSON display. |
| `lib/api.ts` | Browser API helpers and kernel response types. |
| `lib/policy.ts`, `lib/prometheus.ts` | Policy YAML conversion/validation and metrics parsing. |
| `lib/hooks.ts`, `lib/constants.ts` | Shared polling and refresh intervals. |
| `lib/theme.ts`, `lib/storage.ts` | Theme initialization and browser preferences. |
| `lib/*.test.ts` | Vitest tests for policy and metrics behavior. |
| `deploy/Dockerfile` | Standalone Next.js container build. |

Kernel code and SDKs live in separate repositories. Dashboard user documentation
lives in the main Rebuno repository. Treat `.next/`, `node_modules/`, and
`tsconfig.tsbuildinfo` as generated output.

## Development and validation

Use Node 24, matching CI and the Dockerfile, and the pnpm version declared in
`package.json`. Run commands from this root:

| Command | Purpose |
| --- | --- |
| `pnpm install --frozen-lockfile` | Install locked dependencies, matching CI. |
| `pnpm dev` | Start the development server. |
| `pnpm test lib/policy.test.ts` | Example of focused tests; adjust to the affected files. |
| `pnpm test` | Run the Vitest suite. |
| `pnpm typecheck` | Check TypeScript types. |
| `pnpm lint` | Run Biome checks; linter rules are disabled in `biome.json`. |
| `pnpm format` | Apply Biome formatting and fixes. |
| `pnpm build` | Build the production app and standalone server. |
| `pnpm start` | Serve the production build. |

For code changes, run focused checks while iterating, then `pnpm test`,
`pnpm typecheck`, and `pnpm lint` before handing off. Run `pnpm build` for changes
to routes, layouts, server/client boundaries, dependencies, or deployment.
Scope formatting to changed files when unrelated edits are present. Keep
`pnpm-lock.yaml` consistent with dependency changes. See
[.github/workflows/ci.yml](.github/workflows/ci.yml) for CI commands.

Unit tests cover policy and metrics helpers and do not require a running kernel.
For UI changes, inspect affected screens against a local kernel, including
loading, empty, error, and pending-action states and both color themes. Report
which checks ran and any unavailable browser or backend validation. For
documentation-only changes, check paths, commands, and implementation
consistency; application tests are unnecessary.

## Server and API boundaries

- Browser requests to the kernel go through `lib/api.ts` and the dashboard's
  `/api/v0/` proxy. Keep kernel credentials and upstream URLs on the server;
  do not expose `REBUNO_API_KEY` through client props, bundles, or public env vars.
- Configure the server with `REBUNO_URL` (default `http://localhost:8080`),
  `REBUNO_API_KEY` when needed, and optional `PROMETHEUS_URL`. A local kernel can
  be started from the main repo with
  `go run ./cmd/rebuno dev --config examples/rebuno.dev.yaml`.
- Preserve API paths, query parameters, request bodies, upstream status codes,
  and null-body responses when changing the proxy. Keep its target constrained
  to the configured kernel and its `/v0/` routes.
- Keep kernel response types and API helpers in `lib/api.ts`. Preserve wire field
  names and error messages. The kernel is authoritative for statuses, approvals,
  and policy enforcement; refresh affected data after successful mutations.
- Keep server-only code out of client components. Use `"use client"` for
  components that need hooks or browser APIs and preserve SSR-safe access to
  browser preferences. Follow the `@/` import alias configured in `tsconfig.json`.

## UI and domain behavior

- Reuse `usePolling` and the intervals in `lib/constants.ts`. Clean up polling on
  unmount and dependency changes, avoid overlapping requests, and prevent stale
  responses from mixing data across executions, filters, or metrics ranges.
  Keep event sequence cursors and cached data scoped to their execution.
- Preserve policy rule order and kernel YAML semantics in `lib/policy.ts`.
  Unsupported bundles must remain editable as raw YAML; do not silently discard
  fields when switching to the visual editor. Validate drafts before saving and
  keep parse/serialize coverage aligned with the kernel's policy format.
- Preserve the metrics `source` distinction. Prometheus provides values over
  a selected range; the kernel fallback provides current values and cumulative
  counters since startup, with no history. Keep missing values distinct from
  zero and retain validation of supported query ranges.
- Follow the existing compact Tailwind layouts and shared components. Support
  light and dark themes, keyboard access, visible focus, and labeled controls.
  Preserve theme initialization before first paint and reduced-motion behavior.
- Keep action feedback explicit: disable duplicate submissions while pending,
  surface failures near the action, and refresh on success. Keep UI copy focused
  on the user's task and meaningful choices.
- Add focused tests for changed behavior in policy conversion, metrics parsing,
  and request handling. Use browser checks for visual changes; avoid tests that
  merely assert incidental markup or implementation structure.

## Documentation

Update the README when setup or configuration changes and keep deployment
instructions consistent with `deploy/Dockerfile` and `next.config.js`.
Update the [dashboard documentation](https://github.com/rebuno/rebuno/blob/main/docs/dashboard.md)
in the main repository when user-facing behavior changes. In a sibling checkout
it is at `../rebuno/docs/dashboard.md`; policy and API contracts are documented
alongside it in `../rebuno/docs/policy.md` and `../rebuno/docs/api.md`.

## Comments, tests, and documentation style

Write repository content for someone reading the finished system with no access
to the task discussion. Changes should read as a natural part of the codebase.

- Keep comments and docstrings concise. Explain non-obvious intent, invariants,
  or constraints when the code cannot express them clearly. Omit comments that
  restate the code or announce an edit.
- Keep conversation references, review replies, task instructions, and abandoned
  approaches out of code, tests, and documentation. Put implementation history
  and change rationale in PR descriptions or commit messages.
- Describe behavior directly in the present tense. Avoid change-relative wording
  such as "now", "new", "previously", "we changed", or "X instead of Y" when it
  only makes sense in the context of the change. Explain a comparison only when
  it helps the reader understand a lasting distinction or compatibility rule.
- Update existing documentation and examples in place. Integrate the final
  behavior into the relevant section; avoid appended fix notes, repeated caveats,
  and explanations of superseded designs. Release notes and migration guides
  can describe changes over time when that is their purpose.
- Name tests for the behavior or invariant they verify. Keep assertions focused
  on meaningful outcomes and failure modes. Preserve useful regression coverage;
  avoid redundant tests, assertions that merely mirror implementation details,
  and test commentary that recounts the debugging session.
- Review the diff for wording that depends on knowing the conversation or the
  previous patch. Remove it or rewrite it as a standalone explanation of the
  current system.
