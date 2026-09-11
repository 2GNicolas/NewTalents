import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];
const required = ['package-lock.json', 'apps/backend/.env.example', 'apps/frontend/.env.example', 'docker/.env.example', 'docker/compose.yaml'];
for (const path of required) if (!existsSync(join(root, path))) failures.push(`missing:${path}`);
for (const path of ['apps/backend/.env.example', 'apps/frontend/.env.example', 'docker/.env.example']) {
  const text = readFileSync(join(root, path), 'utf8');
  if (!text.includes('__REQUIRED__')) failures.push(`placeholder-policy:${path}`);
}
const prismaRoot = join(root, 'apps/backend/prisma');
const prismaFiles = readdirSync(prismaRoot, { recursive: true }).map(String);
if (prismaFiles.some((file) => /migration|seed/i.test(file))) failures.push('prisma-artifact');
const schema = readFileSync(join(prismaRoot, 'schema.prisma'), 'utf8');
if (/^\s*(model|enum)\s+/m.test(schema)) failures.push('prisma-domain-schema');
const source = ['apps/backend/src', 'apps/frontend/app'].flatMap((base) => readdirSync(join(root, base), { recursive: true }).map((file) => join(base, String(file))));
if (source.some((file) => /auth|user|player|passport|payment|academy|match|statistic/i.test(file))) failures.push('business-module');
if (failures.length) throw new Error(`Foundation verification failed: ${failures.join(',')}`);
console.log('Foundation scope and artifact verification passed.');
