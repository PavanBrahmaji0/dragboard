import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from '../src/EventEmitter.js';

test('EventEmitter: on, emit, off, once, and chaining', () => {
  const ee = new EventEmitter();
  const calls = [];

  const handlerA = (v) => calls.push(['a', v]);
  const handlerB = (v) => calls.push(['b', v]);

  assert.equal(ee.on('ping', handlerA), ee);
  ee.on('ping', handlerB);
  ee.emit('ping', 1);
  assert.deepEqual(calls, [['a', 1], ['b', 1]]);

  assert.equal(ee.off('ping', handlerA), ee);
  ee.emit('ping', 2);
  assert.deepEqual(calls, [['a', 1], ['b', 1], ['b', 2]]);

  ee.once('onceEvt', (v) => calls.push(['once', v]));
  ee.emit('onceEvt', 'x');
  ee.emit('onceEvt', 'y');
  assert.deepEqual(calls.slice(-1), [['once', 'x']]);
});

test('EventEmitter: mutating listeners inside emit does not skip subsequent listeners', () => {
  const ee = new EventEmitter();
  const order = [];

  ee.once('ev', () => order.push('first-once'));
  ee.on('ev', () => order.push('second'));
  ee.emit('ev');

  assert.deepEqual(order, ['first-once', 'second']);
});
