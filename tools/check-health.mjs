const target = process.argv[2];
if (!['live', 'ready'].includes(target)) throw new Error('Usage: node tools/check-health.mjs live|ready');
const expectedStatus = target === 'live' ? 200 : 200;
const expectedBody = target === 'live' ? { status: 'ok' } : { status: 'ready' };
const response = await fetch(`http://localhost:3000/health/${target}`, { signal: AbortSignal.timeout(15_000) });
const body = await response.json();
if (response.status !== expectedStatus || response.headers.get('cache-control') !== 'no-store' || JSON.stringify(body) !== JSON.stringify(expectedBody)) {
  throw new Error(`Health ${target} verification failed`);
}
console.log(`Health ${target} verification passed.`);
