import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const REQUIRED_FIELDS = [
  'POSTGRES_DB',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'POSTGRES_HOST_PORT',
];
const PLACEHOLDERS = new Set(['__REQUIRED__', 'CHANGE_ME']);

export function parseEnvironment(text) {
  const values = new Map();
  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values.set(key, value);
  }
  return values;
}

export function validatePostgresEnvironmentText(text) {
  const values = parseEnvironment(text);
  const errors = [];
  for (const field of REQUIRED_FIELDS) {
    const value = values.get(field);
    if (!value || PLACEHOLDERS.has(value)) {
      errors.push(`${field} must be explicitly configured.`);
    }
  }

  const portValue = values.get('POSTGRES_HOST_PORT');
  if (portValue && !PLACEHOLDERS.has(portValue)) {
    const port = Number(portValue);
    if (!/^\d+$/u.test(portValue) || !Number.isInteger(port) || port < 1 || port > 65535) {
      errors.push('POSTGRES_HOST_PORT must be a valid TCP port.');
    }
  }
  return errors;
}

export async function validateEnvironmentFile(path) {
  try {
    return validatePostgresEnvironmentText(await readFile(path, 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return ['Local PostgreSQL environment file is missing.'];
    }
    return ['Local PostgreSQL environment file could not be read.'];
  }
}

export async function main() {
  const errors = await validateEnvironmentFile(new URL('./.env', import.meta.url));
  if (errors.length > 0) {
    console.error(`Local PostgreSQL configuration invalid: ${errors.join(' ')}`);
    process.exitCode = 1;
    return;
  }
  console.log('Local PostgreSQL configuration validation passed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
