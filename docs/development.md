# Development

[Back to the README](../README.md)

## Tests

From the repository root, with `PI_PKG_ROOT` pointing to the installed
`@earendil-works/pi-coding-agent` package (the tests print SKIP without it):

```sh
npm test
node --test frame.test.mjs
node --test integration.test.mjs
script -q -e -c 'node --test integration.test.mjs' /dev/null
```

Tests use only isolated constructed messages and installed render classes, with
no providers, sessions or shell/tool executions. Integration also uses Pi's
actual extension loader and confirms prototype identity and restore/reload. The
PTY command checks isolated integration only.

Regression tests cover tool mouse dispatch for plain, outline and float
renderers, including original row/column/width/height and descriptor
restoration.

Pi loads `index.ts` with strip-types; loader success is not a typecheck. A human
`/reload` visual check is the normal post-load acceptance step, not an
automated verification result.

## Layout

| Path | Holds |
| --- | --- |
| `index.ts` | the extension: command, toggles, install/restore |
| `frame.mjs` | the pure framing and painting code |
| `*.test.mjs` | unit and integration tests |
| `docs/` | the documents the README links |
