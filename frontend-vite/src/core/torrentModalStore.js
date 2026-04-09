let _open = false;
const listeners = new Set();

export const torrentModalStore = {
  get open() { return _open; },
  set(val) {
    _open = val;
    listeners.forEach(fn => fn(val));
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
