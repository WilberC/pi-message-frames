# pi-message-frames

**Colored frames around every Pi chat message, with collapse, click-to-expand
and timestamps.** A presentation-only [Pi](https://pi.dev) and
[Gentle Shell](https://github.com/Gentleman-Programming/gentle-shell) extension.

## What it does

Each message kind gets its own framed card with a titled rail and a subtle
background: `❯` user, `✦` assistant, `⚙` tool, `$` bash, `⟳` subagent,
`≡` compaction/branch summaries, `◇` skills and custom entries. Titles carry
the start time, end time and duration of each frame:

```text
✦ Assistant · ▶ 14:03 · ⏹ 14:05 · ⏱ 1.5s
```

Tool and bash output collapses to its first lines; a left click expands it.

## What it solves

- **A long chat is a wall of text.** Frames make it obvious where a message
  starts and who wrote it.
- **Tool output buries the conversation.** Passive collapse keeps tool and
  bash frames to three lines until you click them open.
- **"When did this run, and how long did it take?"** Every frame shows its
  clock and its own duration, frozen when its work ends; failures show `✗`.

It changes presentation only: no tools, model hooks, session access or
execution overrides. `/message-frames off` restores the native look at once.

## Install

```bash
# Gentle Shell
gentle-shell install npm:pi-message-frames

# Pi
pi install npm:pi-message-frames
```

Then `/reload` inside the session. To try unreleased changes from `main`:
`pi install git:github.com/WilberC/pi-message-frames`.

## Quick reference

| Command | Effect |
| --- | --- |
| `/message-frames on\|off` | install or remove the frames immediately |
| `/message-frames status` | current state and every toggle |
| `/message-frames timer on\|off` | show or hide the per-frame duration |
| `/message-frames start on\|off` | show or hide the start time |
| `/message-frames end on\|off` | show or hide the end time |

## Documentation

| I want to… | Read |
| --- | --- |
| Learn every command, collapse and timestamp rule | [docs/usage.md](docs/usage.md) |
| Understand what gets wrapped, and the known limits | [docs/architecture.md](docs/architecture.md) |
| Run the tests or work on the code | [docs/development.md](docs/development.md) |

## Credits and license

A fork of [`message-frames`](https://github.com/RamonsDka/gs3-sidebar/tree/main/extensions/message-frames)
by **RamonsDka** (gs3-sidebar, MIT). The framing core — render wrappers, ANSI
background compositing, OSC 133 zone preservation, unframing of existing chrome
and the ownership/restore protocol — is his original work. This fork adds
passive collapse, click-to-expand, render-cycle metadata, timestamp/duration
titles and the Pi package. MIT, see [LICENSE](LICENSE) for the dual copyright
notice; design references are listed in [docs/architecture.md](docs/architecture.md#references).
