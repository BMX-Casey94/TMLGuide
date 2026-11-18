# Accepted security risks

## picomatch ReDoS (GHSA-fc5q-39xc-vjpf), build and lint tooling only

- Status as of 18 November 2026: advisory flags all picomatch versions, including the latest (4.0.7). No patched release exists.
- Affected paths: `vite`, `vitest`, `tinyglobby`, `fdir`, `eslint-config-next` (via `fast-glob` and `micromatch`) and `@parcel/watcher` (via `next-intl`'s file watcher).
- Why accepted: it needs an attacker-controlled glob pattern. These tools only match against our own repository paths and config. None of it runs in the deployed site at request time.
- The suggested `npm audit fix --force` downgrades `vitest` and `eslint-config-next`, which is worse than the risk, so it is not applied.
- CI fails on critical findings (`npm audit --audit-level=critical`). Re-check this entry whenever dependencies change, and remove it once a patched picomatch is released.
