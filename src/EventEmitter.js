export class EventEmitter {
  constructor() {
    this._listeners = {};
  }

  on(event, cb) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(cb);
    return this; // chainable
  }

  off(event, cb) {
    if (!this._listeners[event]) return this;
    this._listeners[event] = this._listeners[event].filter(fn => fn !== cb);
    return this;
  }

  once(event, cb) {
    const wrapper = (...args) => { this.off(event, wrapper); cb(...args); };
    return this.on(event, wrapper);
  }

  emit(event, ...args) {
    (this._listeners[event] || []).forEach(fn => fn(...args));
  }
}
