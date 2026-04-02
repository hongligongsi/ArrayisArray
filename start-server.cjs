const { spawn } = require('child_process');

const child = spawn('node', ['node_modules/tsx/dist/cli.mjs', 'server/index.ts'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

child.on('error', (err) => {
  console.error('Failed to start server:', err);
});

child.on('exit', (code) => {
  console.log('Server exited with code:', code);
  process.exit(code || 0);
});

console.log('Starting server...');
