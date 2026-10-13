import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const url = 'http://127.0.0.1:3102';
const scenarios = process.argv.includes('--development');
const dataRoot = resolve(root, '.test-data');
mkdirSync(dataRoot, { recursive: true });
const dataDirectory = mkdtempSync(resolve(dataRoot, 'e2e-'));
const server = spawn(process.execPath, [resolve(root, 'apps/server/dist/index.js'), '--port=3102', ...(scenarios ? ['--development'] : [])], { cwd: root, stdio: ['ignore','pipe','inherit'], env: { ...process.env, OPENTAVERNS_DATA_DIR: dataDirectory, OPENTAVERNS_ADMIN_KEY: 'e2e-only-key-abcdefghijklmnopqrstuvwxyz0123456789' } });
server.stdout.on('data', data => process.stdout.write(data.toString().split('\n').filter(line => !line.includes('Host management (private)')).join('\n')));
let tests;
const stop = () => { tests?.kill(); server.kill(); };
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw Error('The test server exited before it was ready.');
    try { if ((await fetch(`${url}/health`, { signal: AbortSignal.timeout(500) })).ok) { ready = true; break; } } catch { /* Retry while the server starts. */ }
    await delay(100);
  }
  if (!ready) throw Error('The test server did not become ready.');
  tests = spawn(process.execPath, [resolve(root, 'node_modules/playwright/cli.js'), 'test', ...process.argv.slice(2).filter(arg => arg !== '--development')], { cwd: root, stdio: 'inherit', env: { ...process.env, OPENTAVERNS_E2E_SCENARIOS: scenarios ? '1' : '' } });
  const [code] = await once(tests, 'exit');
  process.exitCode = code ?? 1;
} finally {
  for (const child of [tests, server]) {
    if (!child || child.exitCode !== null) continue;
    child.kill();
    await Promise.race([once(child, 'exit'), delay(2000)]);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
  if (dataDirectory.startsWith(dataRoot + sep)) rmSync(dataDirectory, { recursive: true, force: true });
}
