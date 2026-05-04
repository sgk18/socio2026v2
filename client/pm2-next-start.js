const { spawn } = require('child_process');
const path = require('path');

const nextBin = path.join(__dirname, 'node_modules', 'next', 'dist', 'bin', 'next');

const child = spawn(process.execPath, [nextBin, 'start'], {
  stdio: 'inherit',
  env: process.env,
  cwd: __dirname,
});

child.on('exit', (code) => {
  process.exit(code);
});

child.on('error', (err) => {
  console.error('Failed to start Next:', err);
  process.exit(1);
});
