# Latency Pareto fixes (cross-package)

Feature doc coordinating performance fixes across Pi extension packages and herdr-sidecar.
Symptom: keystroke echo in the Pi TUI inside Herdr feels delayed and worsens as the session grows.
All fixes stay inside our own packages; herdr (Rust) itself is out of scope for this round.

## Specs

- S1: "busca que puntos de mejora tenemos en performance y hagamos un analisis de pareto para
  solucionar los mas importantes pueden ser varios incluso en varios de los paquetes que tenemos
  en herdr o pi (todas las soluciones deben ser unicamente en nuestros paquetes porque son cosas
  que podemos controler)" — user request, verbatim (sic).
- S2: "Mientras mas avanza la session mas lento se vuelve." — fixes must prioritize costs that
  grow with session/conversation length and run inside Pi's process (the echo path).
- S3: "Igual verifica todos los paquetes y demas y ve si es que podemos aumentar nuestro
  performance en varios lados." — audit covered pi-tokstream, pi-message-frames,
  pi-chat-recap, pi-herdr-workspace-title, herdr-sidecar(-tokstream), herdr (Rust).
- S4: Everything is on stable working versions; fixes must preserve current behavior/output
  (journal contents, frame visuals, recap payloads) and only change when/how work happens.
- S5: Changes are test-first where runnable tests exist (node --test for Pi packages, go test
  for sidecar); each fix pins its behavior with a focused test.

## Pareto ranking (from audit evidence, highest impact first)

- P1 pi-tokstream — F1: sync mkdirSync+appendFileSync per text delta (index.ts:111-124,
  lib/journal.mjs:31-32), runs in Pi's process on the token stream; README claims a throttle
  that does not exist. Blocks echo path, several writes/ms observed.
- P2 pi-message-frames — compose()/unframe()/background() regex pipeline re-executes for every
  rendered message on every TUI repaint (frame.mjs:118, 63-116); cost grows with visible
  session content (most messages are frozen/done and never change).
- P3 pi-chat-recap — F6: full exchange text sync append per assistant message including
  pending re-appends inside tool loops (index.ts:142, lib/journal.mjs:59-60); F7:
  structuredClone of the entire conversation per settled turn (index.ts:158-162,
  lib/exchange.mjs:170-171), O(session text) in Pi's process.
- P4 herdr-sidecar — F10: recapTail re-marshals and re-folds every retained exchange each 1 s
  (internal/agent/recap.go:227-235); F12: 1 MiB scanner cap with no sc.Err() handling pins the
  offset and re-reads ~1 MiB per tick forever (agent.go:567, journal.go:90, recap.go:155);
  F11: `herdr pane get` subprocess spawn per tick (agent.go:417-431). Own process, CPU pressure.
- Deferred (reported, not this round): pi-herdr-workspace-title F4/F5 (per-prompt sync reads,
  concurrent nested model call), herdr Rust F19/F20, low items F2/F3/F8/F9/F13-F15.

## Tasks

- T1 [S1,S2,S4,S5] pi-tokstream: throttle sample journal writes (e.g. min interval + flush on
  end), keep journal format; test that N deltas in <interval produce 1 append + final flush.
  Route: worker. Commit: yes (repo pi-tokstream).
- T2 [S1,S2,S4,S5] pi-message-frames: cache framed lines keyed by (width, body, title, collapse
  state) so frozen messages skip the regex paint pipeline on repaint; invalidate on any input.
  Route: worker. Commit: yes (repo pi-message-frames).
- T3 [S1,S2,S4,S5] pi-chat-recap: publish once per exchange lifecycle (no pending re-append per
  tool-loop message); replace whole-history structuredClone in agent_settled with a targeted
  lookup. Route: worker. Commit: yes (repo pi-chat-recap).
- T4 [S1,S2,S4,S5] herdr-sidecar(-tokstream): incremental recap fold from byte offset like
  tailJournal, handle scanner errors and advance past oversized lines, avoid per-tick
  `herdr pane get` when the socket source is authoritative. Route: worker. Commit: yes
  (repo herdr-sidecar).
- T5 [S1,S2,S3,S4,S5] pi-herdr-workspace-title: F4 cut the 2-3 sync reads of herdr
  session.json per prompt to one cached read per invocation; F5 stop running the nested
  autotitle model call concurrently with the first real turn (trigger it after the turn
  settles). Route: worker. Commit: yes (repo pi-herdr-workspace-title).
- T7 [S2,S4,S5] pi-tokstream: F2 rotate the producer-keyed sample journal by size so
  session switches re-fold only bounded bytes (sidecar already refolds on shrink).
  Route: worker. Commit: yes (repo pi-tokstream).
- T8 [S1,S2,S4,S5] pi-chat-recap: F8/F9 make session_start replay not re-append every
  exchange (resume/reload cost). Route: worker. Commit: yes (repo pi-chat-recap).
- T9 [S1,S2,S4,S5] herdr-sidecar: F13 memoize per-render exchange counters so View cost
  stops growing with exchanges; F15 reconcile hook skips shell-outs while the agent is
  not live. Route: worker. Commit: yes (repo herdr-sidecar).
- T10 [S4,S5] herdr (Rust): F19 gate agent-detection recompute so streaming does not
  invalidate the idle-skip every read; F20 soften scrollback compression growth. Route:
  worker. Commit: yes (repo herdr). Highest-risk repo: preserve behavior, heavy tests.
- T11 [S3,S5] Verify: run each package's test suite; report failures verbatim, no green-washing.
- T12 [S1] Commit each work unit on its repo (rounds 1–2: main/master, per user's choice); record
  commits here.

## Pending

Open follow-ups recorded 2026-11-21 after closing both rounds. None block new feature work.

Low/conditional items intentionally skipped (cost-benefit or environment-specific): F3 tokstream
relay readFileSync (once per subagent terminal event), F14 sidecar vitals ticker (held-open stream,
not session-dependent), F17/F18 herdr client io/encoding scans (O(chunk)), F21 session save
debounce (background thread), F22 kitty-graphics ids set (process-wide, tiny).

- P1 (issue-worthy, herdr): global-PATH test race — `src/pane.rs:3815`
  (`login_shell_builder_resolves_bare_shell_names_from_path`, via `integration_env_lock`) mutates
  process-global PATH while `src/platform/linux.rs:1376` spawns `sh` under a different lock; makes
  full `cargo test` fail on one clipboard test. Needs either a shared lock or `Command::env`.
- P2 (issue-worthy, herdr-sidecar): shrink/rotation detection is size-only
  (`journal.go:76 st.Size() < journalOffset`): a same-size-or-larger replacement file keeps the
  old offset. A content marker or epoch in the journal header would make rotation/truncation
  detection exact.
- P3 (minor, pi-tokstream): rotation is best-effort — a failed `renameSync` silently degrades to
  unbounded growth (by design journals never break the host). Consider a warnOnce at most.
- P4 (theoretical, herdr): F19 residual — an app-side mutation that changes terminal text without
  advancing `detection_content_seq` would serve a stale cached scan. None found in production code;
  pin with a test if one ever appears.
- P5 (deferred audit items, unchanged semantics): pi-herdr-workspace-title spawns remain (2 CLI
  calls per settle now, instead of per prompt); herdr viewport-read wake narrowing (F19b) not
  measured at the API level because server-backed integration tests fail on this host pre-existing.
- P6 (deploy note): after the 2026-11-21 commits, run a full Pi process restart (not /reload, not
  /new) so the ESM module cache picks fresh sibling modules; sidecar needs `go build` when run from
  source. Old processes can still emit crash traces referencing stale line numbers (e.g. the
  already-fixed index.ts:173 lastExchange error) — verify against the repo before diagnosing.

## Log

- L1 (S1,S2,S3 verbatim): "pi-message-frames afecta el performance el timer porque se repitan a
  cada momento? Hemos agregado varias cosas y a veces cuando escribo lo siento con un poco de
  delay, busca que puntos de mejora tenemos en performance y hagamos un analisis de pareto para
  solucionar los mas importantes pueden ser varios incluso en varios de los paquetes que temos
  en herdr o pi (todas las soluciones deben ser unicamente en nuestros paquetes porque son cosas
  que podemos controler). Mientras mas avanza la session mas lento se vuelve. Igual verifica
  todos los paquetes y demas y ve si es que podemos aumentar nuestro performance en varios lados.
  Todo esta en una version estable donde todo funciona, pero el performance aun puede mejorar"
- L2: Explore audit returned F1-F22 with file:line evidence; no repeating timers exist in
  pi-message-frames (the timer label is computed per render, no setInterval).
- L3: All four tasks implemented via background writers, verified, committed on main and pushed:
  T1 pi-tokstream 036a369 (tests 19 pass); T2 pi-message-frames 6438c75 (tests 23 pass, 87-case
  differential 0 diffs, frozen repaint ~209x faster); T3 pi-chat-recap 901b85e (tests 50 pass,
  README contract updated by parent); T4 herdr-sidecar 9d47d7b (go test ./... ok, -race clean).
- L4 (user, verbatim): "Si, sigue con los demas - quiero que quede la mejor manera posible antes
  de continuar con nuevos features" — authorizes round 2: T5 workspace-title, T7 tokstream
  rotation, T8 recap replay, T9 sidecar view counters + reconcile, T10 herdr Rust detection/
  compression. Low items F3/F14/F17/F18/F21/F22 intentionally skipped (cost-benefit not favorable
  or environment-specific).
- L5: Round 2 complete, all committed on main/master and pushed: T5 1a3939e (21 tests), T7 fe34736
  (23 tests), T8+T3b 6c3cdbe (55 tests, includes the lastExchangeCompat stale-module hardening for
  a production crash the user reported live), T9 3aa7dc7 (804 tests, docs/configuration.md updated
  by parent), T10 d93305e3 on herdr master (cargo build ok, pane suite 324 pass, RED/GREEN observed,
  full-suite failures proven pre-existing via stash; Zig 0.16.0 installed via mise to enable the
  build). herdr working tree retains 5 pre-existing dirty files unrelated to T10, left untouched.
- L6 (user, verbatim): "ok, hay cosas pendientes? puedes guardarlo en el odd?" — pending items
  recorded below as P1-P6; none block new feature work. Task list renumbered T1-T12 (original
  T4 typo for the sidecar task kept as T4 to preserve its history).
