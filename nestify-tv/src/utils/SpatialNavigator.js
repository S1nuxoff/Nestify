/**
 * SpatialNavigator — ported from Lampa (public/vender/navigator/navigator.js).
 * Converted to ES module. Core algorithm unchanged.
 *
 * 9-zone spatial navigation with straightOnly + overlap threshold.
 */

function SpatialNavigator() {
  this._focus = null;
  this._previous = null;
  this._collection = [];
}

SpatialNavigator.prototype = {
  straightOnly: true,
  straightOverlapThreshold: 0.5,
  ignoreHiddenElement: true,
  rememberSource: false,
  navigableFilter: null,
  silent: false,

  // ── minimal event emitter ─────────────────────────────────────────────────
  follow(type, listener) {
    if (!this._listeners) this._listeners = {};
    if (!this._listeners[type]) this._listeners[type] = [];
    if (!this._listeners[type].includes(listener)) this._listeners[type].push(listener);
  },
  removeListener(type, listener) {
    if (!this._listeners) return;
    const arr = this._listeners[type];
    if (arr) { const i = arr.indexOf(listener); if (i !== -1) arr.splice(i, 1); }
  },
  send(type, event) {
    if (!this._listeners) return;
    const arr = this._listeners[type];
    if (arr) { event.target = this; arr.slice(0).forEach(fn => fn.call(this, event)); }
  },

  // ── rect helpers ──────────────────────────────────────────────────────────
  _getRect(elem) {
    if (!this._isNavigable(elem)) return null;
    let rect = null;
    if (elem.getBoundingClientRect) {
      const cr = elem.getBoundingClientRect();
      rect = { left: cr.left, top: cr.top, width: cr.width, height: cr.height };
    } else if (elem.left !== undefined) {
      rect = {
        left: parseInt(elem.left || 0, 10),
        top: parseInt(elem.top || 0, 10),
        width: parseInt(elem.width || 0, 10),
        height: parseInt(elem.height || 0, 10),
      };
    }
    if (!rect) return null;
    rect.element = elem;
    rect.right = rect.left + rect.width;
    rect.bottom = rect.top + rect.height;
    rect.center = {
      x: rect.left + Math.floor(rect.width / 2),
      y: rect.top + Math.floor(rect.height / 2),
    };
    rect.center.left = rect.center.right = rect.center.x;
    rect.center.top = rect.center.bottom = rect.center.y;
    return rect;
  },

  _getAllRects(excludedElem) {
    const rects = [];
    this._collection.forEach(elem => {
      if (excludedElem && excludedElem === elem) return;
      const rect = this._getRect(elem);
      if (rect) rects.push(rect);
    });
    return rects;
  },

  _isNavigable(elem) {
    if (this.ignoreHiddenElement && elem instanceof HTMLElement) {
      const cs = window.getComputedStyle(elem);
      if (
        (elem.offsetWidth <= 0 && elem.offsetHeight <= 0) ||
        cs.getPropertyValue('visibility') === 'hidden' ||
        cs.getPropertyValue('display') === 'none' ||
        elem.hasAttribute('aria-hidden')
      ) return false;
    }
    if (this.navigableFilter && !this.navigableFilter(elem)) return false;
    return true;
  },

  // ── 9-zone partition ──────────────────────────────────────────────────────
  _partition(rects, targetRect) {
    const groups = [[], [], [], [], [], [], [], [], []];
    const threshold = (this.straightOverlapThreshold >= 0 && this.straightOverlapThreshold <= 1)
      ? this.straightOverlapThreshold : 0.5;

    rects.forEach(rect => {
      const { center } = rect;
      const x = center.x < targetRect.left ? 0 : center.x <= targetRect.right ? 1 : 2;
      const y = center.y < targetRect.top ? 0 : center.y <= targetRect.bottom ? 1 : 2;
      const gid = y * 3 + x;
      groups[gid].push(rect);

      if ([0, 2, 6, 8].includes(gid)) {
        if (rect.left <= targetRect.right - targetRect.width * threshold) {
          if (gid === 2) groups[1].push(rect);
          else if (gid === 8) groups[7].push(rect);
        }
        if (rect.right >= targetRect.left + targetRect.width * threshold) {
          if (gid === 0) groups[1].push(rect);
          else if (gid === 6) groups[7].push(rect);
        }
        if (rect.top <= targetRect.bottom - targetRect.height * threshold) {
          if (gid === 6) groups[3].push(rect);
          else if (gid === 8) groups[5].push(rect);
        }
        if (rect.bottom >= targetRect.top + targetRect.height * threshold) {
          if (gid === 0) groups[3].push(rect);
          else if (gid === 2) groups[5].push(rect);
        }
      }
    });
    return groups;
  },

  _getDistanceFunction(targetRect) {
    return {
      nearPlumbLineIsBetter(rect) {
        const d = rect.center.x < targetRect.center.x
          ? targetRect.center.x - rect.right
          : rect.left - targetRect.center.x;
        return d < 0 ? 0 : d;
      },
      nearHorizonIsBetter(rect) {
        const d = rect.center.y < targetRect.center.y
          ? targetRect.center.y - rect.bottom
          : rect.top - targetRect.center.y;
        return d < 0 ? 0 : d;
      },
      nearTargetLeftIsBetter(rect) {
        const d = rect.center.x < targetRect.center.x
          ? targetRect.left - rect.right
          : rect.left - targetRect.left;
        return d < 0 ? 0 : d;
      },
      nearTargetTopIsBetter(rect) {
        const d = rect.center.y < targetRect.center.y
          ? targetRect.top - rect.bottom
          : rect.top - targetRect.top;
        return d < 0 ? 0 : d;
      },
      topIsBetter: rect => rect.top,
      bottomIsBetter: rect => -1 * rect.bottom,
      leftIsBetter: rect => rect.left,
      rightIsBetter: rect => -1 * rect.right,
    };
  },

  _prioritize(priorities, target, direction) {
    const destPriority = priorities.find(p => !!p.group.length);
    if (!destPriority) return null;

    if (
      this.rememberSource &&
      this._previous &&
      target === this._previous.destination &&
      direction === this._previous.reverse
    ) {
      const found = destPriority.group.find(d => d.element === this._previous.source);
      if (found) return found;
    }

    destPriority.group.sort((a, b) =>
      destPriority.distance.reduce((ans, fn) => ans || (fn(a) - fn(b)), 0)
    );
    return destPriority.group[0];
  },

  // ── public API ────────────────────────────────────────────────────────────
  setCollection(collection) {
    this.unfocus();
    this._collection = [];
    if (collection) this.multiAdd(collection);
  },

  add(elem) {
    if (this._collection.includes(elem)) return false;
    this._collection.push(elem);
    return true;
  },

  multiAdd(elements) {
    return Array.from(elements).every(this.add, this);
  },

  remove(elem) {
    const i = this._collection.indexOf(elem);
    if (i < 0) return false;
    if (this._focus === elem) this.unfocus();
    this._collection.splice(i, 1);
    return true;
  },

  multiRemove(elements) {
    return Array.from(elements).every(this.remove, this);
  },

  /** Set internal focus state without emitting events. */
  focused(elem) {
    this._focus = elem;
  },

  focus(elem) {
    if (!elem && this._focus && this._isNavigable(this._focus)) elem = this._focus;
    if (!this._collection) return false;
    if (!elem) {
      const nav = this._collection.filter(e => this._isNavigable(e));
      if (!nav.length) return false;
      elem = nav[0];
    } else if (!this._collection.includes(elem) || !this._isNavigable(elem)) {
      return false;
    }
    this.unfocus();
    this._focus = elem;
    if (!this.silent) this.send('focus', { elem: this._focus });
    return true;
  },

  unfocus() {
    if (this._focus) {
      const elem = this._focus;
      this._focus = null;
      if (!this.silent) this.send('unfocus', { elem });
    }
    return true;
  },

  getFocusedElement() {
    return this._focus;
  },

  move(direction) {
    const reverse = { left: 'right', up: 'down', right: 'left', down: 'up' };
    if (!this._focus) {
      this._previous = null;
      this.focus();
    } else {
      const elem = this.navigate(this._focus, direction);
      if (!elem) return false;
      if (this.rememberSource) {
        this._previous = {
          source: this._focus,
          destination: elem,
          reverse: reverse[direction.toLowerCase()],
        };
      }
      this.unfocus();
      this.focus(elem);
    }
    return true;
  },

  canmove(direction) {
    if (this._focus) {
      const elem = this.navigate(this._focus, direction);
      if (elem !== null) return elem;
    }
    return false;
  },

  navigate(target, direction) {
    if (!target || !direction || !this._collection) return null;
    direction = direction.toLowerCase();

    const rects = this._getAllRects(target);
    const targetRect = this._getRect(target);
    if (!targetRect || !rects.length) return null;

    const D = this._getDistanceFunction(targetRect);
    const groups = this._partition(rects, targetRect);
    const internalGroups = this._partition(groups[4], targetRect.center);

    let priorities;
    switch (direction) {
      case 'left':
        priorities = [
          { group: internalGroups[0].concat(internalGroups[3], internalGroups[6]), distance: [D.nearPlumbLineIsBetter, D.topIsBetter] },
          { group: groups[3], distance: [D.nearPlumbLineIsBetter, D.topIsBetter] },
          { group: groups[0].concat(groups[6]), distance: [D.nearHorizonIsBetter, D.rightIsBetter, D.nearTargetTopIsBetter] },
        ];
        break;
      case 'right':
        priorities = [
          { group: internalGroups[2].concat(internalGroups[5], internalGroups[8]), distance: [D.nearPlumbLineIsBetter, D.topIsBetter] },
          { group: groups[5], distance: [D.nearPlumbLineIsBetter, D.topIsBetter] },
          { group: groups[2].concat(groups[8]), distance: [D.nearHorizonIsBetter, D.leftIsBetter, D.nearTargetTopIsBetter] },
        ];
        break;
      case 'up':
        priorities = [
          { group: internalGroups[0].concat(internalGroups[1], internalGroups[2]), distance: [D.nearHorizonIsBetter, D.leftIsBetter] },
          { group: groups[1], distance: [D.nearHorizonIsBetter, D.leftIsBetter] },
          { group: groups[0].concat(groups[2]), distance: [D.nearPlumbLineIsBetter, D.bottomIsBetter, D.nearTargetLeftIsBetter] },
        ];
        break;
      case 'down':
        priorities = [
          { group: internalGroups[6].concat(internalGroups[7], internalGroups[8]), distance: [D.nearHorizonIsBetter, D.leftIsBetter] },
          { group: groups[7], distance: [D.nearHorizonIsBetter, D.leftIsBetter] },
          { group: groups[6].concat(groups[8]), distance: [D.nearPlumbLineIsBetter, D.topIsBetter, D.nearTargetLeftIsBetter] },
        ];
        break;
      default:
        return null;
    }

    if (this.straightOnly) priorities.pop();

    const dest = this._prioritize(priorities, target, direction);
    return dest ? dest.element : null;
  },
};

export { SpatialNavigator };
