// Polyfills for Hermes (React Native's JS engine).
// Must run BEFORE any library (Supabase, etc.) is imported.

// 0. Patch Object.getOwnPropertyDescriptors to handle undefined/null safely.
// Babel's object-spread helper calls this, and if the source is undefined it throws
// "Cannot convert undefined value to object". This is the #1 crash cause on Hermes.
(function () {
  var original = Object.getOwnPropertyDescriptors;
  if (original) {
    Object.getOwnPropertyDescriptors = function (obj: any) {
      if (obj == null) return {};
      return original(obj);
    } as any;
  }
})();

// Also patch Object.keys / Object.entries / Object.values for the same reason
(function () {
  var origKeys = Object.keys;
  Object.keys = function (obj: any) {
    if (obj == null) return [];
    return origKeys(obj);
  } as any;
  var origValues = Object.values;
  if (origValues) {
    Object.values = function (obj: any) {
      if (obj == null) return [];
      return origValues(obj);
    } as any;
  }
  var origEntries = Object.entries;
  if (origEntries) {
    Object.entries = function (obj: any) {
      if (obj == null) return [];
      return origEntries(obj);
    } as any;
  }
})();

// 1. crypto.getRandomValues — needed by bcryptjs and uuid generation
if (typeof globalThis.crypto === 'undefined') {
  (globalThis as any).crypto = {
    getRandomValues(arr: Uint8Array) {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
  };
}

// 2. Full URLSearchParams polyfill
(function () {
  var NativeUSP = typeof URLSearchParams !== 'undefined' ? URLSearchParams : undefined;
  var needsPatch = false;

  if (!NativeUSP) {
    needsPatch = true;
  } else {
    try {
      var test = new NativeUSP();
      test.set('a', '1');
      if (test.get('a') !== '1') needsPatch = true;
    } catch (_e) {
      needsPatch = true;
    }
  }

  if (!needsPatch) return;

  function PolyUSP(this: any, init?: any) {
    this._entries = [];
    if (!init) return;
    if (typeof init === 'string') {
      var s = init.charAt(0) === '?' ? init.slice(1) : init;
      var pairs = s.split('&');
      for (var i = 0; i < pairs.length; i++) {
        if (!pairs[i]) continue;
        var idx = pairs[i].indexOf('=');
        var key = idx === -1 ? pairs[i] : pairs[i].slice(0, idx);
        var val = idx === -1 ? '' : pairs[i].slice(idx + 1);
        this._entries.push([decodeURIComponent(key.replace(/\+/g, ' ')), decodeURIComponent(val.replace(/\+/g, ' '))]);
      }
    } else if (Array.isArray(init)) {
      for (var j = 0; j < init.length; j++) {
        this._entries.push([String(init[j][0]), String(init[j][1])]);
      }
    } else if (typeof init === 'object') {
      var keys = Object.keys(init);
      for (var k = 0; k < keys.length; k++) {
        this._entries.push([keys[k], String(init[keys[k]])]);
      }
    }
  }

  PolyUSP.prototype.get = function (name: string) {
    for (var i = 0; i < this._entries.length; i++) {
      if (this._entries[i][0] === name) return this._entries[i][1];
    }
    return null;
  };

  PolyUSP.prototype.set = function (name: string, value: string) {
    var found = false;
    var newEntries: any[] = [];
    for (var i = 0; i < this._entries.length; i++) {
      if (this._entries[i][0] === name) {
        if (!found) {
          newEntries.push([name, String(value)]);
          found = true;
        }
      } else {
        newEntries.push(this._entries[i]);
      }
    }
    if (!found) newEntries.push([name, String(value)]);
    this._entries = newEntries;
  };

  PolyUSP.prototype.append = function (name: string, value: string) {
    this._entries.push([name, String(value)]);
  };

  PolyUSP.prototype.delete = function (name: string) {
    this._entries = this._entries.filter(function (e: any) { return e[0] !== name; });
  };

  PolyUSP.prototype.has = function (name: string) {
    for (var i = 0; i < this._entries.length; i++) {
      if (this._entries[i][0] === name) return true;
    }
    return false;
  };

  PolyUSP.prototype.getAll = function (name: string) {
    var result: any[] = [];
    for (var i = 0; i < this._entries.length; i++) {
      if (this._entries[i][0] === name) result.push(this._entries[i][1]);
    }
    return result;
  };

  PolyUSP.prototype.forEach = function (callback: any, thisArg?: any) {
    for (var i = 0; i < this._entries.length; i++) {
      callback.call(thisArg, this._entries[i][1], this._entries[i][0], this);
    }
  };

  PolyUSP.prototype.keys = function () {
    var idx = 0;
    var entries = this._entries;
    return {
      [Symbol.iterator]() { return this; },
      next: function () {
        return idx < entries.length
          ? { value: entries[idx++][0], done: false }
          : { value: undefined, done: true };
      },
    };
  };

  PolyUSP.prototype.values = function () {
    var idx = 0;
    var entries = this._entries;
    return {
      [Symbol.iterator]() { return this; },
      next: function () {
        return idx < entries.length
          ? { value: entries[idx++][1], done: false }
          : { value: undefined, done: true };
      },
    };
  };

  PolyUSP.prototype.entries = function () {
    var idx = 0;
    var entries = this._entries;
    return {
      [Symbol.iterator]() { return this; },
      next: function () {
        return idx < entries.length
          ? { value: entries[idx++], done: false }
          : { value: undefined, done: true };
      },
    };
  };

  PolyUSP.prototype[Symbol.iterator] = function () {
    return this.entries();
  };

  PolyUSP.prototype.toString = function () {
    return this._entries
      .map(function (e: any) {
        return encodeURIComponent(e[0]) + '=' + encodeURIComponent(e[1]);
      })
      .join('&');
  };

  PolyUSP.prototype.sort = function () {
    this._entries.sort(function (a: any, b: any) {
      return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
    });
  };

  (globalThis as any).URLSearchParams = PolyUSP;
})();

// 3. Full URL polyfill with proper relative-path resolution
(function () {
  var NativeURL: any = typeof URL !== 'undefined' ? URL : undefined;
  var needsPatch = false;
  var searchParamsWorks = false;

  if (!NativeURL) {
    needsPatch = true;
  } else {
    try {
      var t = new NativeURL('https://example.com/path?q=1');
      // Test that property access actually works
      if (typeof t.protocol !== 'string' || t.protocol !== 'https:') needsPatch = true;
      if (typeof t.hostname !== 'string' || t.hostname !== 'example.com') needsPatch = true;
      if (typeof t.pathname !== 'string' || t.pathname !== '/path') needsPatch = true;

      // Test whether searchParams is a LIVE reference: appends must be
      // reflected in url.toString() and url.search. Supabase JS relies on
      // this behavior; if it is broken (or if we replace it with a stateless
      // getter) every filter like .eq('id', X) is silently dropped, so the
      // server returns the whole table.
      var tsp = new NativeURL('https://example.com/');
      tsp.searchParams.append('id', 'eq.abc');
      if (tsp.toString().indexOf('id=eq.abc') !== -1 && tsp.search.indexOf('id=eq.abc') !== -1) {
        searchParamsWorks = true;
      }
    } catch (_e) {
      needsPatch = true;
    }
  }

  if (!needsPatch && searchParamsWorks) {
    // Native URL and its searchParams are healthy — leave them alone.
    return;
  }

  if (!needsPatch && !searchParamsWorks) {
    // Native URL parses OK but its searchParams doesn't mutate the URL.
    // Wrap the getter so appends/sets update the URL's search.
    try {
      var LiveSPKey = '__poly_sp';
      Object.defineProperty(URL.prototype, 'searchParams', {
        get: function () {
          var self = this;
          var cached = (self as any)[LiveSPKey];
          if (cached && cached.__srcSearch === self.search) return cached;
          var sp = new (globalThis as any).URLSearchParams(self.search || '');
          var mutators = ['append', 'set', 'delete', 'sort'];
          mutators.forEach(function (m) {
            var orig = sp[m];
            sp[m] = function () {
              var r = orig.apply(sp, arguments);
              var q = sp.toString();
              self.search = q ? '?' + q : '';
              sp.__srcSearch = self.search;
              return r;
            };
          });
          sp.__srcSearch = self.search;
          try { Object.defineProperty(self, LiveSPKey, { value: sp, writable: true, configurable: true, enumerable: false }); } catch (_) {}
          return sp;
        },
        enumerable: true,
        configurable: true,
      });
    } catch (_e2) { /* ignore */ }
    return;
  }

  // Regex to parse an absolute URL:
  // protocol :// [user:pass@] host [:port] [/path] [?search] [#hash]
  var URL_RE = /^([a-z][a-z0-9+\-.]*):\/\/(?:([^:@]*)(?::([^@]*))?@)?([^:/?\#]*)(?::(\d+))?(\/[^?\#]*)?(\?[^#]*)?(#.*)?$/i;

  function parseAbsolute(href: string) {
    var m = URL_RE.exec(href);
    if (!m) return null;
    return {
      protocol: (m[1] || '').toLowerCase() + ':',
      username: m[2] || '',
      password: m[3] || '',
      hostname: (m[4] || '').toLowerCase(),
      port: m[5] || '',
      pathname: m[6] || '/',
      search: m[7] || '',
      hash: m[8] || '',
    };
  }

  function resolvePath(basePath: string, relPath: string) {
    if (relPath.charAt(0) === '/') return normalizePath(relPath);
    // Relative to base directory
    var baseDir = basePath.substring(0, basePath.lastIndexOf('/') + 1);
    return normalizePath(baseDir + relPath);
  }

  function normalizePath(path: string) {
    var parts = path.split('/');
    var out: string[] = [];
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] === '..') {
        if (out.length > 1) out.pop();
      } else if (parts[i] !== '.') {
        out.push(parts[i]);
      }
    }
    var result = out.join('/');
    if (result.charAt(0) !== '/') result = '/' + result;
    return result;
  }

  function PatchedURL(this: any, input: string, base?: string) {
    var href = String(input);
    var parsed = parseAbsolute(href);

    if (!parsed && base) {
      // Resolve relative URL against base
      var baseParsed = typeof base === 'string' ? parseAbsolute(base) : null;
      if (base && typeof (base as any).href === 'string') {
        baseParsed = parseAbsolute((base as any).href);
      }
      if (!baseParsed) throw new TypeError('Invalid URL: ' + input);

      if (href === '') {
        parsed = { ...baseParsed };
      } else if (href.charAt(0) === '/') {
        parsed = { ...baseParsed, pathname: normalizePath(href.split('?')[0].split('#')[0]), search: '', hash: '' };
        var qIdx = href.indexOf('?');
        if (qIdx !== -1) {
          var hIdx = href.indexOf('#', qIdx);
          parsed.search = hIdx !== -1 ? href.substring(qIdx, hIdx) : href.substring(qIdx);
          if (hIdx !== -1) parsed.hash = href.substring(hIdx);
        } else {
          var hIdx2 = href.indexOf('#');
          if (hIdx2 !== -1) parsed.hash = href.substring(hIdx2);
        }
      } else {
        // Relative path
        var relParts = href.split('#');
        var relNoHash = relParts[0];
        var relHash = relParts.length > 1 ? '#' + relParts[1] : '';
        var relQParts = relNoHash.split('?');
        var relPathPart = relQParts[0];
        var relSearch = relQParts.length > 1 ? '?' + relQParts[1] : '';

        parsed = {
          ...baseParsed,
          pathname: resolvePath(baseParsed.pathname, relPathPart),
          search: relSearch,
          hash: relHash,
        };
      }
    }

    if (!parsed) throw new TypeError('Invalid URL: ' + input);

    this.protocol = parsed.protocol;
    this.username = parsed.username;
    this.password = parsed.password;
    this.hostname = parsed.hostname;
    this.port = parsed.port;
    this.pathname = parsed.pathname || '/';
    this.search = parsed.search;
    this.hash = parsed.hash;

    // Computed properties
    this.host = this.hostname + (this.port ? ':' + this.port : '');
    this.origin = this.protocol + '//' + this.host;
    this.href = this.origin
      + this.pathname
      + this.search
      + this.hash;
  }

  PatchedURL.prototype.toString = function () {
    // Recompute href from parts so mutations to search/pathname/hash reflect.
    this.href = this.origin + this.pathname + (this.search || '') + (this.hash || '');
    return this.href;
  };
  PatchedURL.prototype.toJSON = function () { return this.toString(); };

  // Live searchParams: appends/sets propagate back to url.search so the
  // request URL actually carries the filters Supabase JS appends.
  Object.defineProperty(PatchedURL.prototype, 'searchParams', {
    get: function () {
      var self = this;
      var cached = self.__sp;
      if (cached && cached.__srcSearch === self.search) return cached;
      var sp = new (globalThis as any).URLSearchParams(self.search || '');
      var mutators = ['append', 'set', 'delete', 'sort'];
      mutators.forEach(function (m) {
        var orig = sp[m];
        sp[m] = function () {
          var r = orig.apply(sp, arguments);
          var q = sp.toString();
          self.search = q ? '?' + q : '';
          sp.__srcSearch = self.search;
          return r;
        };
      });
      sp.__srcSearch = self.search;
      try { Object.defineProperty(self, '__sp', { value: sp, writable: true, configurable: true, enumerable: false }); } catch (_) { self.__sp = sp; }
      return sp;
    },
    enumerable: true,
    configurable: true,
  });

  // Preserve static methods if native URL has them
  if (NativeURL) {
    if (typeof NativeURL.createObjectURL === 'function') {
      (PatchedURL as any).createObjectURL = function () {
        return NativeURL.createObjectURL.apply(NativeURL, arguments);
      };
    }
    if (typeof NativeURL.revokeObjectURL === 'function') {
      (PatchedURL as any).revokeObjectURL = function () {
        return NativeURL.revokeObjectURL.apply(NativeURL, arguments);
      };
    }
  }

  (globalThis as any).URL = PatchedURL;
})();
