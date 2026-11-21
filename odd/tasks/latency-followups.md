# Latency Pareto follow-ups P1-P4

Fix the four code-level pending items recorded in `odd/tasks/latency-pareto.md` (P5 deferred by user until all others are done).

## Specs

- S1 (P1 verbatim from pending list): "global-PATH test race — `src/pane.rs:3815` (`login_shell_builder_resolves_bare_shell_names_from_path`, via `integration_env_lock`) mutates process-global PATH while `src/platform/linux.rs:1376` spawns `sh` under a different lock; makes full `cargo test` fail on one clipboard test. Needs either a shared lock or `Command::env`."
- S2 (P2 verbatim): "shrink/rotation detection is size-only (`journal.go:76 st.Size() < journalOffset`): a same-size-or-larger replacement file keeps the old offset. A content marker or epoch in the journal header would make rotation/truncation detection exact."
- S3 (P3 verbatim): "rotation is best-effort — a failed `renameSync` silently degrades to unbounded growth (by design journals never break the host). Consider a warnOnce at most."
- S4 (P4 verbatim): "F19 residual — an app-side mutation that changes terminal text without advancing `detection_content_seq` would serve a stale cached scan. None found in production code; pin with a test if one ever appears."

## Tasks

- T1 (S1, herdr) route: inline (writer gate: doc lives in pi-message-frames, not delegable), commit on repo
- T2 (S2, herdr-sidecar) route: inline (writer gate: doc lives in pi-message-frames), commit
- T3 (S3, pi-tokstream) route: inline (writer gate: doc lives in pi-message-frames), commit
- T4 (S4, herdr) route: inline test, commit

## Log

- L1 (user, verbatim): "p6 e reiniciado la PC y vuelto a abrir gentle-shell incluso en una nueva sesion eso bastaria o necesitas un nuevo go build igual? y has de la p1 a la p4, la p5 dejemoslo para el ultimo y cuando tengamos todo lo demas echo lo volvemos a analizar"
- L2: Sidecar binary was stale (09:23 build vs 10:06 commit); parent rebuilt `bin/sidecar-hud` at 10:35. herdr installed via mise (0.9.5, Oct 25) predates T1/T10 fixes — deployment of herdr itself is a user decision, flagged.
- L3: P5 explicitly deferred by the user; do not resolve it in this feature.
- L4: Round executed inline (writer gate rejected delegation: feature doc lives in
  pi-message-frames, not in each repo root). Result so far:
  - P3 (tokstream cad3cfe): warnOnce on failed rotate; journal suite 9 + package 24 pass.
  - P2 (sidecar ccfccbe): journal header identity (sessionId+ts of first record) detected
    as replacement/rewrite marker; two RED tests observed (same-size replacement, padded
    same-session rewrite), unparseable header keeps legacy behavior; agent package + go vet clean.
  - P1+P4 (herdr, uncommitted): pane.rs test helper now mirrors production
    observe_detection_content_change (RED 0!=1 observed first) + pin test; platform/linux.rs:
    the file-local env_lock was replaced by the shared integration_env_lock across ALL env-
    mutating/PATH-spawning tests (the issue named one test; the race actually spans two lock
    domains); suite pane 325 ok, linux suite 5x ok, cross-module 5x ok. Full suite SIGPIPE crash
    (deterministic, after client_popup_plain_page_key, no test failure precedes it) under
    baseline comparison via stash cycle (job-5).
- L5: Findings: herdr installed binary (mise 0.9.5, Oct 25) predates T1/T10; the running
  sidecar-hud process (started 10:30) still used the stale 09:23 build until relaunch —
  a `go build` alone is not enough, the process must be restarted.
- L6: Full-suite SIGPIPE crash confirmed PRE-EXISTING: baseline (stash cycle, no local
  changes) exits 101 with the same signal after the same pass count; no test failure precedes
  it. One real flake seen in a parallel run (git worktree "failed to write commit object"),
  passes alone — environment, not the change. P1+P4 signed off on that basis.
