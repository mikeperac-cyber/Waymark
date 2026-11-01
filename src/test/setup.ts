// Node.js >= 21 exposes a built-in `localStorage` global that can shadow the
// jsdom implementation, leaving a stub without a working Storage API (no
// `.clear()` / `.setItem()`). Force the jsdom Storage implementation so the
// workspace persistence tests run against a real Web Storage mock.
// Node.js >= 21 defines a built-in `localStorage` global. Without the
// `--localstorage-file` flag it is `undefined`, and because the jsdom window is
// the test global, that undefined value shadows jsdom's own Storage-backed
// `localStorage`. Pull jsdom's working Storage instance off `window` and
// reinstall it on the global so the workspace persistence tests run against a
// real Web Storage mock. jsdom's `Storage` is not directly constructible, so we
// reuse the instance jsdom already created.
// Node.js >= 21 defines a built-in `localStorage` global. Without the
// `--localstorage-file` flag it evaluates to `undefined`, and because the jsdom
// window is the same object as the test global, that undefined value shadows
// jsdom's own Storage-backed `localStorage`, leaving no working Web Storage.
// Install a small in-memory Storage implementation so the workspace
// persistence tests exercise real set/get/clear round-tripping.
const backing = new Map<string, string>();
const memoryStorage: Storage = {
  get length() {
    return backing.size;
  },
  clear: () => {
    backing.clear();
  },
  getItem: (key: string) => (backing.has(String(key)) ? backing.get(String(key))! : null),
  key: (index: number) => (Array.from(backing.keys())[index] ?? null),
  removeItem: (key: string) => {
    backing.delete(String(key));
  },
  setItem: (key: string, value: string) => {
    backing.set(String(key), String(value));
  },
} as Storage;

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  writable: true,
  value: memoryStorage,
});

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: () => {},
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
