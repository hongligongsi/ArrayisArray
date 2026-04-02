import { spawn } from 'child_process';

const child = spawn('node', ['node_modules/tsx/dist/cli.mjs', 'server/index.ts'], {
  cwd: import.meta.dirname(new URL(import.meta.url).pathname),
  stdio: 'inherit',
  shell: false
});

child.on('error', (err) => {
  console.error('Failed to start server:', err);
});

child.on('exit', (code) => {
  console.log('Server exited with code:', code);
  process.exit(code || 0);
});

console.log('Starting server...');
