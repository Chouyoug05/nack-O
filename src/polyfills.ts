/**
 * Polyfills pour iOS 12.5.8 / Safari 12.1
 * Chargés AVANT React et les composants Radix UI.
 *
 * - ResizeObserver : absent de Safari < 13.4 — requis par Radix UI (useSize, ScrollArea)
 * - scrollIntoView(options) : seul le format boolean est supporté sur Safari < 14
 * - MediaQueryList.addEventListener : absent de Safari < 14 — sonner utilise addListener en fallback
 */

// ---------- Détection navigateur hérité ----------
// Doit être exécuté AVANT tout polyfill pour capturer l'état natif réel.
// Sur les vieux navigateurs (iOS 9, Safari < 11), on désactivera le Service Worker
// PWA pour éviter qu'il mette en cache une version cassée.
(function () {
  if (typeof window === 'undefined') return;

  let legacy = false;

  // 1. Absence native de Promise.allSettled (ES2020) → navigateur < Safari 13
  if (typeof Promise === 'undefined' || typeof Promise.allSettled !== 'function') {
    legacy = true;
  }

  // 2. Versions iOS / Safari très anciennes détectées via User-Agent
  if (!legacy && typeof navigator !== 'undefined') {
    const ua = navigator.userAgent || '';
    // iOS: "iPhone OS 9_3" / "CPU OS 9_3" / "CPU iPhone OS 12_1"
    const iosMatch = ua.match(/OS (\d+)[_.\d]*/i);
    if (iosMatch) {
      const iosMajor = parseInt(iosMatch[1], 10);
      if (iosMajor < 11) legacy = true; // iOS < 11 → pas de SW fiable
    }
    // Safari desktop < 11
    const safariMatch = ua.match(/Version\/(\d+)/);
    if (safariMatch && /Safari/.test(ua) && !/Chrome/.test(ua) && !/CriOS/.test(ua)) {
      const safariMajor = parseInt(safariMatch[1], 10);
      if (safariMajor < 11) legacy = true;
    }
  }

  (window as any).__NACK_LEGACY_BROWSER__ = legacy;

  // Marqueur CSS : permet de désactiver les animations/effets GPU lourds
  // sur les appareils très anciens (ex: iPad 3 / iOS 9).
  if (legacy && typeof document !== 'undefined' && document.documentElement) {
    try {
      document.documentElement.className += ' legacy-browser';
    } catch { /* ignore */ }
  }
})();

// ---------- Promise.allSettled ----------
// ES2020 — absent de Safari < 13 / iOS < 13 — utilisé par recharts
(function () {
  if (typeof Promise === 'undefined') return;
  if (typeof Promise.allSettled === 'function') return;

  Promise.allSettled = function (iterable: Iterable<any>): Promise<any[]> {
    return Promise.all(
      Array.from(iterable).map(function (item: any) {
        return Promise.resolve(item).then(
          function (value) { return { status: 'fulfilled', value: value }; },
          function (reason) { return { status: 'rejected', reason: reason }; }
        );
      })
    );
  } as typeof Promise.allSettled;
})();


// ---------- structuredClone ----------
// ES2022 — absent de Safari < 15.4 / iOS < 15.4 — utilisé par Firebase SDK
(function () {
  if (typeof (globalThis as any).structuredClone === 'function') return;

  (globalThis as any).structuredClone = function structuredClone(value: any, options?: StructuredSerializeOptions): any {
    if (value === null || typeof value !== 'object') return value;
    if (value instanceof Date) return new Date(value.getTime());
    if (value instanceof RegExp) return new RegExp(value.source, value.flags);
    if (value instanceof Map) {
      const m = new Map();
      value.forEach(function (v: any, k: any) { m.set(structuredClone(k, options), structuredClone(v, options)); });
      return m;
    }
    if (value instanceof Set) {
      const s = new Set();
      value.forEach(function (v: any) { s.add(structuredClone(v, options)); });
      return s;
    }
    if (Array.isArray(value)) return value.map(function (v: any) { return structuredClone(v, options); });
    if (typeof value === 'object') {
      var result: any = {};
      for (var key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          result[key] = structuredClone(value[key], options);
        }
      }
      return result;
    }
    return value;
  };
})();


// ---------- ResizeObserver ----------
// Basé sur juggle/resize-observer-polyfill (MIT) — version simplifiée et compacte
(function () {
  if (typeof window === 'undefined') return;
  if (typeof (window as any).ResizeObserver !== 'undefined') return; // natif présent

  // Map de stockage des targets observés
  const targets = new WeakMap<any, Array<{ callback: ResizeObserverCallback; observer: any }>>();

  class DOMRectReadOnlyPolyfill implements DOMRectReadOnly {
    x = 0;
    y = 0;
    width = 0;
    height = 0;
    top = 0;
    right = 0;
    bottom = 0;
    left = 0;
    toJSON() {
      return { x: this.x, y: this.y, width: this.width, height: this.height, top: this.top, right: this.right, bottom: this.bottom, left: this.left };
    }
    constructor(init?: Partial<DOMRectReadOnly>) {
      if (init) {
        this.x = init.x ?? 0;
        this.y = init.y ?? 0;
        this.width = init.width ?? 0;
        this.height = init.height ?? 0;
        this.top = init.top ?? 0;
        this.right = init.right ?? 0;
        this.bottom = init.bottom ?? 0;
        this.left = init.left ?? 0;
      }
    }
  }

  function calculateDepth(node: Node): number {
    let depth = 0;
    let current: Node | null = node;
    while (current) {
      depth++;
      current = current.parentNode;
    }
    return depth;
  }

  function broadcastChanges(observers: { callback: ResizeObserverCallback; observer: any }[], target: Element) {
    const rect = target.getBoundingClientRect();
    const entry: ResizeObserverEntry = {
      target,
      contentRect: new DOMRectReadOnlyPolyfill({
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
      }),
      borderBoxSize: [{
        inlineSize: rect.width,
        blockSize: rect.height,
      }],
      devicePixelContentBoxSize: [],
    } as unknown as ResizeObserverEntry;

    for (const { callback, observer } of observers) {
      try {
        callback([entry], observer);
      } catch (e) {
        console.error('[ResizeObserver polyfill] callback error:', e);
      }
    }
  }

  let rafId = 0;
  const pendingNotifications = new Map<Element, { observers: { callback: ResizeObserverCallback; observer: any }[]; target: Element }>();

  function processQueue() {
    for (const [, data] of pendingNotifications) {
      broadcastChanges(data.observers, data.target);
    }
    pendingNotifications.clear();
    rafId = 0;
  }

  function scheduleNotification(target: Element) {
    if (pendingNotifications.has(target)) return;
    const observers = targets.get(target);
    if (!observers || observers.length === 0) return;

    pendingNotifications.set(target, { observers, target });
    if (rafId === 0) {
      rafId = requestAnimationFrame(processQueue);
    }
  }

  // Surveillance via mutation + scroll + resize (fallback pour les browsers sans ResizeObserver)
  const observedElements = new WeakSet<Element>();

  function startTracking(element: Element) {
    if (observedElements.has(element)) return;
    observedElements.add(element);

    let lastWidth = element.clientWidth;
    let lastHeight = element.clientHeight;

    function check() {
      if (!observedElements.has(element)) return;
      const w = element.clientWidth;
      const h = element.clientHeight;
      if (w !== lastWidth || h !== lastHeight) {
        lastWidth = w;
        lastHeight = h;
        scheduleNotification(element);
      }
      requestAnimationFrame(check);
    }
    requestAnimationFrame(check);
  }

  class ResizeObserverPolyfill implements ResizeObserver {
    private _callback: ResizeObserverCallback;
    private _targets = new Map<Element, { callback: ResizeObserverCallback; observer: ResizeObserver }>();

    constructor(callback: ResizeObserverCallback) {
      this._callback = callback;
    }

    observe(target: Element) {
      if (this._targets.has(target)) return;
      const entry = { callback: this._callback, observer: this as unknown as ResizeObserver };
      this._targets.set(target, entry);

      const list = targets.get(target) || [];
      list.push(entry);
      targets.set(target, list);

      startTracking(target);

      // Notification initiale
      scheduleNotification(target);
    }

    unobserve(target: Element) {
      const entry = this._targets.get(target);
      if (!entry) return;
      this._targets.delete(target);

      const list = targets.get(target);
      if (list) {
        const idx = list.indexOf(entry);
        if (idx !== -1) list.splice(idx, 1);
        if (list.length === 0) targets.delete(target);
      }
    }

    disconnect() {
      for (const [target] of this._targets) {
        this.unobserve(target);
      }
    }
  }

  (window as any).ResizeObserver = ResizeObserverPolyfill;
})();


// ---------- scrollIntoView(options) ----------
// Safari < 14 ne supporte pas scrollIntoView({ block: "nearest" }) — il faut convertir en boolean
(function () {
  if (typeof window === 'undefined') return;
  if (typeof document === 'undefined') return;

  const proto = Element.prototype;
  const original = proto.scrollIntoView;

  proto.scrollIntoView = function (arg?: boolean | ScrollIntoViewOptions) {
    if (arg === undefined || arg === null) {
      return original.call(this, true);
    }
    if (typeof arg === 'boolean') {
      return original.call(this, arg);
    }
    // Convertir les options en boolean — "center" → true (smooth scroll), le reste → false (instant)
    if (typeof arg === 'object') {
      const block = arg.block;
      if (block === 'start' || block === 'center') {
        return original.call(this, true);
      }
      return original.call(this, false);
    }
    return original.call(this, true);
  };
})();


// ---------- MediaQueryList.addEventListener ----------
// Safari < 14 : MediaQueryList n'hérite pas d'EventTarget — addListener() est la seule méthode
// Sur iOS 12, window.MediaQueryList peut être undefined (le constructeur n'est pas une globale).
// On patche le prototype de l'objet retourné par matchMedia() pour garantir la compatibilité.
(function () {
  if (typeof window === 'undefined') return;
  if (typeof window.matchMedia === 'undefined') return;

  const test = window.matchMedia('(prefers-color-scheme: dark)');
  if (test && typeof test.addEventListener === 'function') return; // natif présent

  // Essayer d'abord via le constructeur global
  let proto: any = undefined;
  try {
    proto = (window as any).MediaQueryList && (window as any).MediaQueryList.prototype;
  } catch { /* ignore */ }

  // Fallback : obtenir le prototype depuis un objet matchMedia réel
  if (!proto && test) {
    proto = Object.getPrototypeOf(test);
  }

  if (proto && typeof proto.addEventListener !== 'function') {
    proto.addEventListener = function (type: string, listener: EventListenerOrEventListenerObject) {
      if (type === 'change') {
        this.addListener(typeof listener === 'function' ? listener : listener.handleEvent);
      }
    };
    proto.removeEventListener = function (type: string, listener: EventListenerOrEventListenerObject) {
      if (type === 'change') {
        this.removeListener(typeof listener === 'function' ? listener : listener.handleEvent);
      }
    };
  }
})();


// ---------- Évènements tactiles (300ms delay fix) ----------
// iOS 9 inflige un délai de ~300ms entre le tap et l'évènement click, ce qui donne
// l'impression que l'UI est gelée / que les boutons "Annuler" ne répondent pas.
// On supprime ce délai en déclenchant un click immédiat sur touchend (style FastClick),
// en veillant à ne pas générer de double-click (ghost click).
(function () {
  if (typeof window === 'undefined') return;
  if (typeof document === 'undefined') return;
  if (!('ontouchstart' in window)) return; // pas d'écran tactile → inutile

  const legacy = (window as any).__NACK_LEGACY_BROWSER__ === true;

  // Désactiver le zoom double-tap (évite les ghost clicks)
  try {
    if (document.documentElement) {
      document.documentElement.style.touchAction = 'manipulation';
    }
  } catch { /* ignore */ }

  const tapTargets = new WeakMap<Element, number>();

  document.addEventListener('touchend', function (ev: Event) {
    if (legacy) {
      // Sur navigateurs hérités, click natif peut ne pas se propager correctement
      // jusqu'aux handlers React dans certaines modales → on force le click.
      const touch = (ev as TouchEvent).changedTouches && (ev as TouchEvent).changedTouches[0];
      if (!touch) return;
      const el = document.elementFromPoint(touch.clientX, touch.clientY) as Element | null;
      if (!el) return;
      const btn = closestClickable(el);
      if (!btn) return;
      const last = tapTargets.get(btn) || 0;
      const now = Date.now();
      if (now - last < 450) return; // déjà traité → ignore le ghost click
      tapTargets.set(btn, now);
      try {
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      } catch {
        try {
          btn.click();
        } catch { /* ignore */ }
      }
    }
  }, false);

  function closestClickable(el: Element): Element | null {
    let cur: Element | null = el;
    while (cur && cur !== document.body) {
      const tag = cur.tagName;
      const role = cur.getAttribute && cur.getAttribute('role');
      if (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || tag === 'SELECT' || tag === 'LABEL' ||
          role === 'button' || role === 'menuitem' || role === 'checkbox' || role === 'radio' ||
          cur.getAttribute && cur.getAttribute('onclick')) {
        return cur;
      }
      cur = cur.parentElement;
    }
    return null;
  }
})();
