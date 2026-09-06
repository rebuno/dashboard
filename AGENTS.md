# Working on the Rebuno Dashboard

This is Rebuno's Next.js dashboard. The kernel owns execution state and policy
enforcement. Read [CONTRIBUTING.md](CONTRIBUTING.md) for setup, server
configuration, and the contribution workflow.

## Development and validation

Use the Node version from CI and the pnpm version in `package.json`. Install with
`pnpm install --frozen-lockfile`. For code changes, run focused checks, then
`pnpm test`, `pnpm typecheck`, and `pnpm lint`. Run `pnpm build` for changes to
routes, layouts, server/client boundaries, dependencies, or deployment. See the
package scripts for other commands; keep the lockfile consistent with dependency
changes.

For UI changes, inspect affected screens against a local kernel in both themes,
including loading, empty, error, and pending-action states. Report unavailable
browser or backend validation. For documentation-only changes, check paths,
commands, and implementation consistency; application tests are unnecessary.

## Dashboard constraints

- Route browser requests through the dashboard's kernel proxy. Keep upstream
  credentials on the server and the proxy target constrained to the configured
  kernel. Preserve request semantics, upstream status codes, and null-body
  responses when changing proxy behavior.
- Keep the kernel authoritative for statuses, approvals, and policy enforcement.
  Refresh affected data after successful mutations and surface action failures.
- Reuse shared polling. Clean up on unmount, avoid overlapping requests, and
  prevent stale responses from mixing data across executions, filters, or
  metrics ranges. Scope event cursors and caches to their execution.
- Preserve policy rule order and YAML semantics. Keep unsupported bundles
  editable as raw YAML; switching to the visual editor must not discard fields.
- Keep Prometheus time-range metrics distinct from the kernel's current values
  and cumulative counters. Missing metrics must remain distinguishable from zero.
- Follow existing components and Tailwind styles. Preserve light/dark themes,
  keyboard access, visible focus, labeled controls, and SSR-safe preferences.
  Keep UI copy focused on the user's task and meaningful choices.

Update the README for setup changes and the
[dashboard docs](https://github.com/rebuno/rebuno/blob/main/docs/dashboard.md)
for user-facing changes. The latter lives in the main Rebuno repository,
under `../rebuno/docs/` in sibling checkouts.

## Comments, tests, and documentation style

Write for someone reading the finished system with no access to the task
conversation. Changes should read as a natural part of the codebase.

- Keep comments and docstrings sparse and concise. Explain non-obvious intent,
  invariants, or constraints; omit restatements of code and announcements of edits.
- Keep conversation references, review replies, and abandoned approaches out of
  source, tests, and docs. Put change history in PRs, commits, release notes, or
  migration guides when relevant.
- Describe current behavior directly in the present tense. Avoid change-relative
  wording such as "now", "previously", or "X instead of Y" unless it explains a
  lasting distinction or compatibility rule.
- Update existing documentation and examples in place. Avoid appended fix notes
  and repeated caveats. Review additions for wording that depends on the task
  discussion or previous patch.
- Add focused regression tests for meaningful behavior and failure modes. Name
  tests for the behavior they verify; avoid redundant coverage, assertions that
  mirror implementation details, and commentary about the debugging session.
