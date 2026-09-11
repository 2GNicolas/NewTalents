import test from 'node:test';
import assert from 'node:assert/strict';

import { isSupportedNodeVersion, parseVersion, validateToolchain } from './verify-toolchain.mjs';

test('parses semantic runtime versions', () => {
  assert.deepEqual(parseVersion('v24.11.0'), [24, 11, 0]);
  assert.equal(parseVersion('24'), null);
});

test('accepts the selected runtime and admitted Node range', () => {
  assert.equal(isSupportedNodeVersion('v24.11.0'), true);
  assert.equal(isSupportedNodeVersion('v24.99.0'), true);
  assert.deepEqual(validateToolchain('v24.11.0', '10.8.0'), []);
});

test('rejects Node versions outside the admitted range', () => {
  assert.equal(isSupportedNodeVersion('v24.10.9'), false);
  assert.equal(isSupportedNodeVersion('v25.0.0'), false);
});

test('rejects a different npm version', () => {
  assert.deepEqual(validateToolchain('v24.11.0', '10.9.0'), ['npm must be version 10.8.0.']);
});
