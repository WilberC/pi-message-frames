import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const root = process.env.PI_PKG_ROOT;
if (!root) { console.log('SKIP: define PI_PKG_ROOT (carpeta del paquete @earendil-works/pi-coding-agent) para correr este test'); process.exit(0); }
const require = createRequire(root + '/package.json');
export const tui = await import(require.resolve('@earendil-works/pi-tui'));
const { frameLines, installFrames, fmtDuration } = await import('./frame.mjs');
export const plain = s => s.replace(/\x1b\[[0-9;:]*m/g, '').replace(/\x1b\][^\x07]*\x07/g, '');

test('rounded role frames: full geometry, ANSI, Unicode, empty and narrow rows', () => {
 for (const width of [0, 1, 2, 3, 4, 12, 60]) {
  for (const body of [[], [''], ['\x1b[31m界 é 👩‍💻\x1b[0m', '', 'tail'], ['a\nb']]) {
   const lines = frameLines(body, width, 'User', [90,170,230], tui);
   if (!width) { assert.deepEqual(lines, []); continue; }
   for (const line of lines) { assert.equal(tui.visibleWidth(line), width); assert.ok(line.endsWith('\x1b[0m')); assert.match(line, /\x1b\[48;2;/); }
   if (width >= 2) { assert.ok(plain(lines[0]).startsWith('╭')); assert.ok(plain(lines[0]).endsWith('╮')); assert.ok(plain(lines.at(-1)).startsWith('╰')); assert.ok(plain(lines.at(-1)).endsWith('╯')); }
   assert.deepEqual(lines, frameLines(body, width, 'User', [90,170,230], tui));
  }
 }
 const colored = frameLines(['\x1b[38;2;40;49;100mRGB\x1b[0m'],30,'User',[90,170,230],tui);
 assert.match(colored[1], /\x1b\[38;2;40;49;100mRGB/);
 const rows = frameLines(['\x1b[31mred\x1b[0m tail', ''], 30, 'Assistant', [90,170,230], tui);
 assert.match(rows[0], /Assistant/); assert.match(rows[1], /\x1b\[31mred/);
 assert.match(rows[1], /\x1b\[0m\x1b\[48;2;/);
 assert.match(rows[2], /\x1b\[48;2;/); assert.equal(plain(rows[2]), '│' + ' '.repeat(28) + '│');
 assert.notEqual(rows[1].match(/48;2;[^m]+/)[0], rows[2].match(/48;2;[^m]+/)[0]);
});

test('wrapper delegates, restores, handles reload and removes existing chrome only', () => {
 class Message { render(w) { return ['\x1b[32mhello\x1b[0m', '', 'x'.repeat(w)]; } update() { return 42; } }
 const original = Message.prototype.render, update = Message.prototype.update;
 const instance = new Message();
 const targets = [[Message, () => 'Tool: read', [90,170,230]]];
 const a = installFrames(targets, tui); const b = installFrames(targets, tui);
 assert.equal(Message.prototype.update, update); assert.equal(instance.update(), 42);
 const rows = instance.render(30); assert.equal(rows.length, 5); assert.match(plain(rows[0]), /Tool: read/);
 assert.deepEqual(rows.slice(1,-1).map(s => plain(s).slice(1,-1).trimEnd()), original.call(instance,28).map(s => plain(s).trimEnd()));
 a.restore(); assert.notEqual(Message.prototype.render, original);
 b.restore(); assert.equal(Message.prototype.render, original);
 const c = installFrames(targets,tui); c.restore(); c.restore(); assert.equal(Message.prototype.render,original);
 const chrome = frameLines(['╭─ old ──╮','│ body   │','╰────────╯'], 16, 'Subagent', [90,170,230], tui);
 assert.equal(chrome.map(plain).join('').split('╭').length - 1,1);
 assert.match(chrome.map(plain).join(''), /old/); assert.match(chrome.map(plain).join(''), /body/);
 assert.throws(() => installFrames([[class {}, ()=>'Bad', []]], tui), /Unsupported/);
});

test('a throw inside our framing falls back to the original render instead of crashing', () => {
 class Message { render(w) { return ['\x1b[32mhello\x1b[0m', '', 'tail']; } }
 const original = Message.prototype.render;
 const instance = new Message();
 const ctl = installFrames([[Message, () => { throw new Error('boom'); }, [90,170,230]]], tui);
 const rows = instance.render(30);
 assert.deepEqual(rows.map(plain), original.call(instance, 30).map(plain));
 assert.ok(rows.every(s => !s.includes('╭')));
 const again = instance.render(30);
 assert.deepEqual(again.map(plain), original.call(instance, 30).map(plain));
 ctl.restore(); assert.equal(Message.prototype.render, original);
 const healthy = new Message();
 const ctl2 = installFrames([[Message, () => 'Tool: ok', [90,170,230]]], tui);
 assert.match(plain(healthy.render(30)[0]), /Tool: ok/);
 ctl2.restore();
});

test('outline slicing removes both original rails, including indented Unicode rows', () => {
 const rows=frameLines(['  ╭─ old ─╮','  │ 界 é  │','  ╰───────╯'],20,'Custom',[90,170,230],tui).map(plain);
 assert.equal(rows[2].split('│').length-1,2);
 assert.equal(rows[2].slice(1,-1).trim(),'界 é');
});

test('passive collapse truncates long collapse targets to a hint row and click restores', () => {
 const body = Array.from({length: 10}, (_,i) => `line ${i}`);
 class ToolLike { render(w) { return body.map(s => s.slice(0, w)); } handleMouse() { return undefined; } invalidate() {} }
 const originalRender = ToolLike.prototype.render, originalMouse = ToolLike.prototype.handleMouse;
 const ctl = installFrames([[ToolLike, () => 'Tool: read', [90,170,230], {collapse: true, collapsedLines: 3}]], tui);
 const inst = new ToolLike();
 const collapsed = inst.render(40);
 assert.equal(collapsed.length, 6); // 3 body + hint + 2 chrome
 assert.match(plain(collapsed.at(-2)), /7 more lines/);
 const click = inst.handleMouse({type: 'click', button: 'left', x: 5, y: 2, screenX: 5, screenY: 2, width: 40, height: collapsed.length});
 assert.ok(click?.handled);
 const expanded = inst.render(40);
 assert.equal(expanded.length, 12); // 10 body + 2 chrome
 assert.ok(!/more lines/.test(expanded.map(plain).join('')));
 assert.ok(inst.handleMouse({type: 'click', button: 'left', x: 5, y: 2, screenX: 5, screenY: 2, width: 40, height: expanded.length})?.handled);
 assert.equal(inst.render(40).length, 6);
 assert.deepEqual(expanded.slice(1,-1).map(s => plain(s).slice(1,-1).trim()), body.map(s => s.slice(0,38).trim()));
 ctl.restore();
 assert.equal(ToolLike.prototype.render, originalRender);
 assert.equal(ToolLike.prototype.handleMouse, originalMouse);
});

test('short bodies of collapse targets stay untouched', () => {
 class ShortTool { render(w) { return ['only one line']; } handleMouse() { return undefined; } }
 const ctl = installFrames([[ShortTool, () => 'Tool: ls', [90,170,230], {collapse: true}]], tui);
 const inst = new ShortTool();
 const rows = inst.render(30);
 assert.equal(rows.length, 3); // 1 body + 2 chrome
 assert.ok(!/more lines/.test(rows.map(plain).join('')));
 ctl.restore();
});

test('collapse targets without native handleMouse get a click toggle that restores cleanly', () => {
 class BashLike { render(w) { return ['out one', 'out two', 'out three', 'out four', 'out five']; } invalidate() {} }
 assert.equal(BashLike.prototype.handleMouse, undefined);
 const ctl = installFrames([[BashLike, () => 'Bash', [215,170,91], {collapse: true}]], tui);
 assert.equal(typeof BashLike.prototype.handleMouse, 'function');
 const inst = new BashLike();
 const collapsed = inst.render(30);
 assert.match(plain(collapsed.at(-2)), /more lines/);
 assert.ok(inst.handleMouse({type: 'click', button: 'left', x: 2, y: 1, screenX: 2, screenY: 1, width: 30, height: collapsed.length})?.handled);
 assert.ok(!/more lines/.test(inst.render(30).map(plain).join('')));
 ctl.restore();
 assert.equal(BashLike.prototype.handleMouse, undefined);
});

test('title functions receive lifecycle meta and fmtDuration formats durations', () => {
 class M { render(w) { return ['x']; } }
 let seen;
 const ctl = installFrames([[M, (_c, meta) => { seen = meta; return 'Tool'; }, [90,170,230], {collapse: true}]], tui);
 const inst = new M();
 inst.render(20); inst.render(20);
 assert.equal(typeof seen.firstMs, 'number');
 assert.equal(typeof seen.lastMs, 'number');
 assert.equal(seen.collapsed, true);
 assert.equal(fmtDuration(500), '500ms');
 assert.equal(fmtDuration(1500), '1.5s');
 assert.equal(fmtDuration(95000), '1:35');
 assert.equal(fmtDuration(undefined), undefined);
 ctl.restore();
});

test('done predicate freezes the render-cycle timer at completion', () => {
 class Tool { render(w) { return ['x']; } }
 const ctl = installFrames([[Tool, (_c, meta) => `${meta.firstMs}-${meta.lastMs}`, [90,170,230], {done: c => c.finished}]], tui);
 const inst = new Tool();
 inst.finished = false;
 inst.render(20); inst.render(20);
 const during = inst.render(20).map(plain).join('');
 inst.finished = true;
 inst.render(20);
 const frozen = inst.render(20).map(plain).join('');
 assert.equal(frozen, during.replace(/\d+-\d+/, m => m)); // lastMs stopped advancing
 inst.render(20); inst.render(20);
 assert.equal(inst.render(20).map(plain).join(''), frozen);
 ctl.restore();
});

test('visible toggles hide their title parts', () => {
 class M { render(w) { return ['x']; } }
 const origRender = M.prototype.render;
 const ctl = installFrames([[M, (_c, m, show) => `T${show.timer?1:0}S${show.start?1:0}E${show.end?1:0}`, [90,170,230], {visible: () => ({timer: true, start: false, end: true})}]], tui);
 const inst = new M();
 assert.match(inst.render(20).map(plain).join(''), /T1S0E1/);
 ctl.restore();
 const off = installFrames([[M, (_c, _m, show) => `T${show.timer?1:0}S${show.start?1:0}E${show.end?1:0}`, [90,170,230], {}]], tui);
 assert.match(new M().render(20).map(plain).join(''), /T1S1E1/);
 off.restore();
 assert.equal(M.prototype.render, origRender);
});
