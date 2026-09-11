import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const REQUIRED_NPM_VERSION = '10.8.0';
export const MINIMUM_NODE_VERSION = [24, 11, 0];
export const MAXIMUM_NODE_MAJOR = 25;

export function parseVersion(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(value.trim());
  return match ? match.slice(1).map(Number) : null;
}

export function isSupportedNodeVersion(value) {
  const version = parseVersion(value);
  if (!version || version[0] >= MAXIMUM_NODE_MAJOR) return false;
  for (let index = 0; index < MINIMUM_NODE_VERSION.length; index += 1) {
    if (version[index] > MINIMUM_NODE_VERSION[index]) return true;
    if (version[index] < MINIMUM_NODE_VERSION[index]) return false;
  }
  return true;
}

export function validateToolchain(nodeVersion, npmVersion) {
  const errors = [];
  if (!isSupportedNodeVersion(nodeVersion)) {
    errors.push('Node.js must satisfy >=24.11.0 <25.');
  }
  if (npmVersion.trim() !== REQUIRED_NPM_VERSION) {
    errors.push('npm must be version 10.8.0.');
  }
  return errors;
}

export function readNpmVersion() {
  if (process.platform === 'win32') {
    return execFileSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'npm --version'], {
      encoding: 'utf8',
      windowsHide: true,
    }).trim();
  }
  return execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim();
}

export function main() {
  const errors = validateToolchain(process.version, readNpmVersion());
  if (errors.length > 0) {
    console.error(`Toolchain validation failed: ${errors.join(' ')}`);
    process.exitCode = 1;
    return;
  }
  console.log('Toolchain validation passed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
