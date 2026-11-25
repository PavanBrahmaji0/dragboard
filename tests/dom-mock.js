function toKebab(str) {
  return str.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
}

function toCamel(str) {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function parseAttributes(attrStr) {
  const attrs = new Map();
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m;
  while ((m = re.exec(attrStr))) {
    const name = m[1].toLowerCase();
    const val = m[2] ?? m[3] ?? m[4] ?? '';
    attrs.set(name, decodeHtml(val));
  }
  return attrs;
}

function decodeHtml(str) {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function parseHtmlInto(parent, html) {
  parent.children = [];
  if (!html || !html.trim()) return;

  const voidTags = new Set(['input', 'br', 'hr', 'img', 'meta', 'link']);
  const stack = [parent];
  const tokenRe = /<!--[\s\S]*?-->|<\/([a-zA-Z0-9-]+)\s*>|<([a-zA-Z0-9-]+)([^>]*?)(\/?)>|([^<]+)/g;
  let m;

  while ((m = tokenRe.exec(html))) {
    if (m[1]) {
      // Closing tag
      const tag = m[1].toUpperCase();
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tagName === tag) {
          stack.length = i;
          break;
        }
      }
    } else if (m[2]) {
      // Opening tag
      const tag = m[2].toUpperCase();
      const attrStr = m[3] || '';
      const selfClose = Boolean(m[4]) || voidTags.has(m[2].toLowerCase());
      const el = parent._ownerDocument.createElement(m[2]);
      const attrs = parseAttributes(attrStr);
      for (const [k, v] of attrs) {
        el.setAttribute(k, v);
        if (k === 'value') el.value = v;
      }
      stack[stack.length - 1].appendChild(el);
      if (!selfClose) stack.push(el);
    } else if (m[5]) {
      const top = stack[stack.length - 1];
      const text = decodeHtml(m[5]);
      if (top.tagName === 'TEXTAREA' || top.tagName === 'OPTION') {
        top.value = (top.value || '') + text;
        top._textContent += text;
      } else if (text.trim()) {
        top._textContent += text;
      }
    }
  }
}

function matchSimpleSelector(el, sel) {
  sel = sel.trim();
  if (!sel) return false;
  if (sel === '*') return true;

  let remaining = sel;
  const tagMatch = remaining.match(/^[a-zA-Z0-9-]+/);
  if (tagMatch) {
    if (el.tagName !== tagMatch[0].toUpperCase()) return false;
    remaining = remaining.slice(tagMatch[0].length);
  }

  const parts = remaining.match(/(\.[a-zA-Z0-9_-]+|#[a-zA-Z0-9_-]+|\[[^\]]+\])/g) || [];
  if (parts.join('') !== remaining) return false;

  for (const part of parts) {
    if (part.startsWith('.')) {
      if (!el.classList.contains(part.slice(1))) return false;
    } else if (part.startsWith('#')) {
      if (el.id !== part.slice(1)) return false;
    } else if (part.startsWith('[')) {
      const inner = part.slice(1, -1);
      const eqIdx = inner.indexOf('=');
      if (eqIdx === -1) {
        if (!el.hasAttribute(inner)) return false;
      } else {
        const attrName = inner.slice(0, eqIdx).trim();
        let expected = inner.slice(eqIdx + 1).trim();
        if ((expected.startsWith('"') && expected.endsWith('"')) ||
            (expected.startsWith("'") && expected.endsWith("'"))) {
          expected = expected.slice(1, -1);
        }
        if (el.getAttribute(attrName) !== expected) return false;
      }
    }
  }
  return true;
}

function matchesSelector(el, selector) {
  const groups = selector.split(',');
  for (const group of groups) {
    const tokens = group.trim().split(/\s+/);
    if (!tokens.length) continue;
    if (!matchSimpleSelector(el, tokens[tokens.length - 1])) continue;
    let cur = el.parentElement;
    let idx = tokens.length - 2;
    while (idx >= 0 && cur) {
      if (matchSimpleSelector(cur, tokens[idx])) idx--;
      cur = cur.parentElement;
    }
    if (idx < 0) return true;
  }
  return false;
}

class MockClassList {
  constructor(el) {
    this._el = el;
    this._set = new Set();
  }
  _syncFromString(str) {
    this._set = new Set(String(str || '').trim().split(/\s+/).filter(Boolean));
  }
  add(...tokens) {
    for (const t of tokens) {
      if (!t || /\s/.test(t)) throw new SyntaxError(`Invalid class token: "${t}"`);
      this._set.add(t);
    }
  }
  remove(...tokens) {
    for (const t of tokens) this._set.delete(t);
  }
  toggle(token, force) {
    if (force === true) { this.add(token); return true; }
    if (force === false) { this.remove(token); return false; }
    if (this._set.has(token)) { this._set.delete(token); return false; }
    this.add(token);
    return true;
  }
  contains(token) {
    return this._set.has(token);
  }
  toString() {
    return [...this._set].join(' ');
  }
}

class MockStyle {
  constructor() {
    this._props = new Map();
    return new Proxy(this, {
      get(target, prop) {
        if (prop in target) return typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop];
        return target._props.get(toKebab(String(prop))) ?? '';
      },
      set(target, prop, value) {
        if (prop in target) {
          target[prop] = value;
        } else {
          target._props.set(toKebab(String(prop)), String(value ?? ''));
        }
        return true;
      },
    });
  }
  setProperty(name, value) {
    this._props.set(name, String(value ?? ''));
  }
  getPropertyValue(name) {
    return this._props.get(name) ?? '';
  }
}

class MockCanvasContext2D {
  constructor() {
    this.calls = [];
    this.fillStyle = '#000000';
    this.strokeStyle = '#000000';
    this.lineWidth = 1;
    this.globalAlpha = 1;
    this.font = '';
    this.textAlign = 'left';
  }
  _rec(name, args) { this.calls.push({ name, args }); }
  scale(x, y) { this._rec('scale', [x, y]); }
  clearRect(x, y, w, h) { this._rec('clearRect', [x, y, w, h]); }
  beginPath() { this._rec('beginPath', []); }
  closePath() { this._rec('closePath', []); }
  moveTo(x, y) { this._rec('moveTo', [x, y]); }
  lineTo(x, y) { this._rec('lineTo', [x, y]); }
  quadraticCurveTo(cpx, cpy, x, y) { this._rec('quadraticCurveTo', [cpx, cpy, x, y]); }
  bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) { this._rec('bezierCurveTo', [cp1x, cp1y, cp2x, cp2y, x, y]); }
  arc(x, y, r, s, e) { this._rec('arc', [x, y, r, s, e]); }
  fill() { this._rec('fill', [this.fillStyle, this.globalAlpha]); }
  stroke() { this._rec('stroke', [this.strokeStyle, this.lineWidth]); }
  fillText(text, x, y) { this._rec('fillText', [text, x, y]); }
  save() { this._rec('save', [this.globalAlpha]); }
  restore() { this._rec('restore', []); }
}

export class MockElement {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName.toUpperCase();
    this._ownerDocument = ownerDocument;
    this.children = [];
    this.parentElement = null;
    this._attrs = new Map();
    this._listeners = new Map();
    this.classList = new MockClassList(this);
    this.style = new MockStyle();
    this._textContent = '';
    this.value = '';
    this.draggable = false;
    this.title = '';
    this._rect = null;
    this._ctx = this.tagName === 'CANVAS' ? new MockCanvasContext2D() : null;

    this.dataset = new Proxy({}, {
      get: (_, prop) => this._attrs.get('data-' + toKebab(String(prop))),
      set: (_, prop, val) => {
        this._attrs.set('data-' + toKebab(String(prop)), String(val));
        return true;
      },
    });
  }

  get id() { return this._attrs.get('id') || ''; }
  set id(v) { this.setAttribute('id', v); }

  get className() { return this.classList.toString(); }
  set className(v) { this.classList._syncFromString(v); }

  get isConnected() {
    let cur = this;
    while (cur) {
      if (cur === this._ownerDocument.body) return true;
      cur = cur.parentElement;
    }
    return false;
  }

  get textContent() {
    if (!this.children.length) return this._textContent;
    return this._textContent + this.children.map(c => c.textContent).join('');
  }
  set textContent(v) {
    this.children = [];
    this._textContent = String(v ?? '');
  }

  get innerHTML() {
    if (this.children.length) return this.children.map(c => c.outerHTML).join('');
    return this._textContent
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  set innerHTML(html) {
    this._textContent = '';
    parseHtmlInto(this, String(html ?? ''));
  }

  get outerHTML() {
    const tag = this.tagName.toLowerCase();
    const attrs = [...this._attrs.entries()].map(([k, v]) => ` ${k}="${v}"`).join('');
    const cls = this.className ? ` class="${this.className}"` : '';
    return `<${tag}${cls}${attrs}>${this.innerHTML}</${tag}>`;
  }

  setAttribute(name, value) {
    const key = name.toLowerCase();
    const val = String(value);
    if (key === 'class') {
      this.classList._syncFromString(val);
    } else if (key === 'title') {
      this.title = val;
      this._attrs.set(key, val);
    } else {
      this._attrs.set(key, val);
    }
  }

  getAttribute(name) {
    const key = name.toLowerCase();
    if (key === 'class') return this.className;
    return this._attrs.get(key) ?? null;
  }

  hasAttribute(name) {
    return this._attrs.has(name.toLowerCase());
  }

  removeAttribute(name) {
    this._attrs.delete(name.toLowerCase());
  }

  appendChild(child) {
    if (child.parentElement) child.remove();
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  remove() {
    if (!this.parentElement) return;
    const idx = this.parentElement.children.indexOf(this);
    if (idx !== -1) this.parentElement.children.splice(idx, 1);
    this.parentElement = null;
  }

  contains(other) {
    let cur = other;
    while (cur) {
      if (cur === this) return true;
      cur = cur.parentElement;
    }
    return false;
  }

  querySelector(selector) {
    for (const child of this.children) {
      if (matchesSelector(child, selector)) return child;
      const found = child.querySelector(selector);
      if (found) return found;
    }
    return null;
  }

  querySelectorAll(selector) {
    const out = [];
    const walk = (node) => {
      for (const child of node.children) {
        if (matchesSelector(child, selector)) out.push(child);
        walk(child);
      }
    };
    walk(this);
    return out;
  }

  closest(selector) {
    let cur = this;
    while (cur) {
      if (matchesSelector(cur, selector)) return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  addEventListener(type, fn) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(fn);
  }

  removeEventListener(type, fn) {
    this._listeners.get(type)?.delete(fn);
  }

  dispatchEvent(event) {
    if (!event.target) event.target = this;
    event.defaultPrevented = false;
    event.preventDefault = () => { event.defaultPrevented = true; };
    let stopped = false;
    event.stopPropagation = () => { stopped = true; };

    let cur = this;
    while (cur && !stopped) {
      event.currentTarget = cur;
      const fns = cur._listeners.get(event.type);
      if (fns) {
        for (const fn of [...fns]) fn(event);
      }
      cur = event.bubbles === false ? null : cur.parentElement;
    }
    return !event.defaultPrevented;
  }

  getBoundingClientRect() {
    if (this._rect) return { ...this._rect };
    const left = parseFloat(this.style.left) || 0;
    const top = parseFloat(this.style.top) || 0;
    const width = parseFloat(this.style.width) || (this.classList.contains('db-grid') ? 1000 : 0);
    const height = parseFloat(this.style.height) || (this.classList.contains('db-grid') ? 800 : 0);
    return { left, top, right: left + width, bottom: top + height, width, height };
  }

  getContext(kind) {
    return kind === '2d' ? this._ctx : null;
  }
}

export function installDomEnv() {
  const resizeObservers = [];

  class MockResizeObserver {
    constructor(cb) {
      this.cb = cb;
      this.targets = new Set();
      this.disconnected = false;
      resizeObservers.push(this);
    }
    observe(el) { this.targets.add(el); }
    unobserve(el) { this.targets.delete(el); }
    disconnect() { this.disconnected = true; this.targets.clear(); }
    trigger() { if (!this.disconnected) this.cb([]); }
  }

  const docListeners = new Map();
  const doc = {
    body: null,
    createElement(tag) {
      return new MockElement(tag, doc);
    },
    querySelector(sel) {
      return doc.body.querySelector(sel);
    },
    querySelectorAll(sel) {
      return doc.body.querySelectorAll(sel);
    },
    addEventListener(type, fn) {
      if (!docListeners.has(type)) docListeners.set(type, new Set());
      docListeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      docListeners.get(type)?.delete(fn);
    },
    dispatchEvent(event) {
      const fns = docListeners.get(event.type);
      if (fns) {
        for (const fn of [...fns]) fn(event);
      }
    },
  };
  doc.body = new MockElement('body', doc);

  const winListeners = new Map();
  const win = {
    devicePixelRatio: 1,
    addEventListener(type, fn) {
      if (!winListeners.has(type)) winListeners.set(type, new Set());
      winListeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      winListeners.get(type)?.delete(fn);
    },
    dispatchEvent(event) {
      const fns = winListeners.get(event.type);
      if (fns) {
        for (const fn of [...fns]) fn(event);
      }
    },
  };

  globalThis.document = doc;
  globalThis.window = win;
  globalThis.ResizeObserver = MockResizeObserver;
  globalThis.requestAnimationFrame = (cb) => { cb(); return 1; };

  return {
    document: doc,
    window: win,
    docListeners,
    winListeners,
    resizeObservers,
    reset() {
      doc.body.children = [];
      docListeners.clear();
      winListeners.clear();
      resizeObservers.length = 0;
    },
  };
}
