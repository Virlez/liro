import { spawnSync } from 'node:child_process';

const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(command, ['run', 'build'], {
  cwd: process.cwd(),
  env: { ...process.env, LIGNECLAIRE_E2E: '1' },
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(result.status ?? 1);
