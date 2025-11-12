// src/api/ws/nestifyPlayerClient.js

class NestifyPlayerClient {
  constructor() {
    this.ws = null;
    this.isConnected = false;

    this.status = null;

    this.listeners = {
      connected: new Set(),
      status: new Set(),
      error: new Set(),
    };

    this.requestId = 1;
    this.pending = new Map();

    this.shouldReconnect = true;
    this.reconnectDelay = 3000;
    this.reconnectTimer = null;
  }

  // ---------- HOST / URL ----------

  /**
   * IP/host берем из current_user.kodi_address, который приходит из БД.
   * Никаких дефолтов.
   */
  getHost() {
    try {
      const raw = window.localStorage.getItem("current_user");
      if (!raw) return null;
      const user = JSON.parse(raw);
      const addr = user?.kodi_address;
      if (addr && typeof addr === "string" && addr.trim()) {
        return addr.trim();
      }
      return null;
    } catch (e) {
      console.error(
        "[NestifyPlayerClient] failed to read current_user.kodi_address:",
        e
      );
      return null;
    }
  }

  getWsUrl() {
    const host = this.getHost();
    if (!host) {
      throw new Error(
        "Nestify Player host is not configured (kodi_address is empty)"
      );
    }
    return `ws://${host}:8889`;
  }

  // поки що getHttpBaseUrl можна залишити, але більше не використовується
  getHttpBaseUrl() {
    const host = this.getHost();
    if (!host) {
      throw new Error(
        "Nestify Player host is not configured (kodi_address is empty)"
      );
    }
    return `http://${host}:8888`;
  }

  // ---------- INIT / WS ----------

  init() {
    if (this.ws) return;
    this.connect();
  }

  connect() {
    let url;
    try {
      url = this.getWsUrl();
    } catch (e) {
      console.warn("[NestifyPlayerClient] WS connect skipped:", e.message);
      // пробуем ещё раз через reconnectDelay — вдруг користувач потім збереже kodi_address
      this.scheduleReconnect();
      return;
    }

    try {
      this.ws = new WebSocket(url);
    } catch (e) {
      console.error("[NestifyPlayerClient] WS create error:", e);
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      console.log("[NestifyPlayerClient] WS connected:", url);
      this.isConnected = true;
      this.emit("connected", true);

      this.getStatusRpc().catch(() => {});
    };

    this.ws.onclose = (evt) => {
      console.warn(
        "[NestifyPlayerClient] WS closed:",
        evt.code,
        evt.reason || ""
      );
      this.isConnected = false;
      this.emit("connected", false);

      this.pending.forEach(({ reject }) =>
        reject(new Error("WS closed before response"))
      );
      this.pending.clear();

      this.ws = null;

      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (err) => {
      console.error("[NestifyPlayerClient] WS error:", err);
      this.emit("error", err);
    };

    this.ws.onmessage = (evt) => {
      this.handleMessage(evt.data);
    };
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelay);
  }

  // ---------- EVENTS ----------

  on(event, handler) {
    if (!this.listeners[event]) return;
    this.listeners[event].add(handler);
  }

  off(event, handler) {
    if (!this.listeners[event]) return;
    this.listeners[event].delete(handler);
  }

  emit(event, payload) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach((cb) => {
      try {
        cb(payload);
      } catch (e) {
        console.error("[NestifyPlayerClient] listener error:", e);
      }
    });
  }

  // ---------- JSON-RPC ----------

  sendRpc(method, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error("WebSocket is not connected"));
        return;
      }

      const id = this.requestId++;
      const payload = {
        jsonrpc: "2.0",
        id,
        method,
        params,
      };

      this.pending.set(id, { resolve, reject });

      try {
        this.ws.send(JSON.stringify(payload));
      } catch (e) {
        this.pending.delete(id);
        reject(e);
      }
    });
  }

  handleMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      console.warn("[NestifyPlayerClient] Bad JSON:", raw);
      return;
    }

    // відповіді на RPC
    if (Object.prototype.hasOwnProperty.call(msg, "id")) {
      const pending = this.pending.get(msg.id);
      if (!pending) return;

      this.pending.delete(msg.id);

      if (msg.error) {
        pending.reject(
          new Error(msg.error.message || "RPC error " + msg.error.code)
        );
      } else {
        pending.resolve(msg.result);
      }
      return;
    }

    // нотифікації
    if (msg.method) {
      const params = msg.params || {};
      const data = params.data || params;
      this.handleNotification(msg.method, data);
    }
  }

  handleNotification(method, data) {
    switch (method) {
      case "Player.OnConnect":
      case "Player.OnPlay":
      case "Player.OnPause":
      case "Player.OnStop":
      case "Player.OnSeek":
      case "Player.OnProgress":
      case "Application.OnVolume":
        if (data) {
          this.status = {
            ...(this.status || {}),
            ...data,
          };
          this.emit("status", this.status);
        }
        break;
      default:
        console.log("[NestifyPlayerClient] Notification:", method, data);
    }
  }

  async getStatusRpc() {
    try {
      const res = await this.sendRpc("Player.GetStatus");
      if (res && typeof res === "object") {
        this.status = {
          ...(this.status || {}),
          ...res,
        };
        this.emit("status", this.status);
      }
      return res;
    } catch (e) {
      console.warn("[NestifyPlayerClient] getStatusRpc error:", e);
      throw e;
    }
  }

  getStatus() {
    return this.status;
  }

  // ---------- CONTROL (через WS) ----------

  playPause() {
    return this.sendRpc("Player.PlayPause").catch((e) =>
      console.warn("Player.PlayPause error:", e)
    );
  }

  stop() {
    return this.sendRpc("Player.Stop").catch((e) =>
      console.warn("Player.Stop error:", e)
    );
  }

  seekMs(positionMs) {
    return this.sendRpc("Player.Seek", { position_ms: positionMs }).catch((e) =>
      console.warn("Player.Seek error:", e)
    );
  }

  seekBySeconds(deltaSec) {
    const st = this.status;
    if (!st || typeof st.position_ms !== "number") return;
    const currentMs = st.position_ms;
    const newMs = Math.max(0, currentMs + deltaSec * 1000);
    return this.seekMs(newMs);
  }

  setVolume(volumePercent) {
    const v = Math.max(0, Math.min(100, volumePercent | 0));
    return this.sendRpc("Application.SetVolume", { volume: v }).catch((e) =>
      console.warn("Application.SetVolume error:", e)
    );
  }

  // ---------- PLAY ON TV (WS: Player.PlayUrl) ----------

  /**
   * Викликається з useMovieSource:
   *   nestifyPlayerClient.playOnTv({
   *     streamUrl,
   *     link,
   *     originName,
   *     title,
   *     image,
   *     movieId,
   *     season,
   *     episode,
   *     userId,
   *     positionSeconds,
   *   })
   */
  async playOnTv({
    streamUrl,
    link,
    originName,
    title,
    image,
    movieId,
    season,
    episode,
    userId,
    positionSeconds,
  }) {
    try {
      const params = {
        url: streamUrl,
        link: link || null,
        origin_name: originName || null,
        title: title || null,
        image: image || null,
        movie_id: movieId ?? null,
        season: season ?? null,
        episode: episode ?? null,
        user_id: userId ?? null,
      };

      if (typeof positionSeconds === "number") {
        params.position_ms = Math.max(0, Math.floor(positionSeconds * 1000));
      }

      await this.sendRpc("Player.PlayUrl", params);
      return true;
    } catch (e) {
      console.error("[NestifyPlayerClient] playOnTv via WS error:", e);
      return false;
    }
  }
}

const nestifyPlayerClient = new NestifyPlayerClient();
export default nestifyPlayerClient;
