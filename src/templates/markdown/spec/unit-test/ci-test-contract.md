# CI Test Contract

> Define CI requirements for type safety and test gates.

---

## Boundary of This Guide

This guide covers only:

- Which checks CI runs
- Required local parity before PR
- Failure triage expectations

This guide does **not** define coverage thresholds (see `coverage-policy.md`).

---

## Current CI Facts

From `.github/workflows/test.yml`:

- Trigger: push and pull_request
- Core checks include:
  - `bun install`
  - `bun typecheck`
  - setup integration test env file for CLI
  - `bun run test`

---

## Contributor Contract

- Run local checks that match CI entry points when possible
- Test-related changes must pass both typecheck and tests before merge
- Required env setup must be documented and reproducible

---

## Failure Handling

- Classify failure first: typecheck vs test vs environment
- Fix root cause; do not bypass checks

---

## Coverage Integration

If CI adds coverage gating, reference policy from `coverage-policy.md` (single source of truth).

---

## Bot Workflow Contract

For GitHub Actions bot workflows using `openai/codex-action@v1`:

- Prepare runner-local `codex-home` explicitly before the action step
- Prefer `${{ runner.temp }}/codex-home` over implicit `~/.codex`
- Treat `read-server-info` ENOENT as startup/runner-state failure, not prompt failure
- If a custom `responses-api-endpoint` is configured, it must be a full Responses API URL ending with `/responses`
- Do not pass provider root URLs like `https://host/` or partial base URLs like `https://host/v1`
- In repositories that cannot use the default OpenAI endpoint, fail fast when `OPENAI_BASE_URL` is missing or malformed instead of silently falling back
- If logs show `stream disconnected before response.completed`, first verify the endpoint path and then verify that the upstream service fully supports Responses streaming semantics

---

## Reference Files in This Repo

- `.github/workflows/test.yml`
- `package.json`
- `cli/vitest.config.ts`
- `web/vitest.config.ts`
