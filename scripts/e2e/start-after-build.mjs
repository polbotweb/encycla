/* global fetch, console, process, setTimeout */
// Second Playwright web server (TikTok mode): the first one builds `dist/`, so wait for it to
// answer before starting another server from the same build, instead of building twice at once.
import { spawn } from 'node:child_process';

const buildServer = process.env.E2E_BUILD_SERVER ?? 'http://127.0.0.1:3100/api/health';
const deadline = Date.now() + 240_000;
for (;;) {
  try {
    const response = await fetch(buildServer);
    if (response.ok) break;
  } catch {
    // not up yet
  }
  if (Date.now() > deadline) {
    console.error(`start-after-build: ${buildServer} did not come up`);
    process.exit(1);
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}
const child = spawn(process.execPath, ['dist/server/index.js'], { stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code ?? 0));
