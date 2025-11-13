// src/api/ws/nestifyPlayerClient.js

/**
 * NestifyPlayerClient v2
 *
 * Тепер схема така:
 *   Frontend  <->  Backend (PlayerHub)  <->  TV app
 *
 * Front конектиться по WS на бекенд:
 *   ws(s)://<WS_BASE>/ws/control/{device_id}
 *
 * JSON-RPC протокол той самий, що й був раніше.
 */

class NestifyPlayerClient {
  constructor() {
    this.ws = null;
    this.isConnected = false;

    // поточний статус, який приходить нотифікаціями Player.OnPlay/OnPause/etc
    this.status = null;

    // підписники
    this.listeners = {
      connected: new Set(),
      status: new Set(),
      error: new Set(),
    };

    // JSON-RPC
    this.requestId = 1;
    this.pending = new Map();

    // reconnect
    this.shouldReconnect = true;
    this.reconnectDelay = 3000;
    this.reconnectTimer = null;

    // TV / Player
    this.deviceId = null;
  }

  // ---------- CONFIG ----------

  /**
   * Задаємо deviceId (той, що показує TV-апка).
   * Можна викликати хоч 100 раз — при зміні deviceId клієнт перепідключиться.
   */
  setDeviceId(deviceId) {
    const trimmed = (deviceId || "").trim();
    if (!trimmed) {
      console.warn("[NestifyPlayerClient] setDeviceId: empty");
      this.deviceId = null;
      this._cleanupSocket();
      return;
    }

    if (this.deviceId === trimmed) {
      return; // нічого не змінилось
    }

    console.log("[NestifyPlayerClient] setDeviceId:", trimmed);
    this.deviceId = trimmed;

    // якщо вже ініціалізовано — перепідключаємось
    if (this.ws) {
      this._cleanupSocket();
    }
    this.connect();
  }

  /**
   * Базовий WS-URL бекенда.
   *
   * Можеш перевизначити через REACT_APP_WS_BASE:
   *   REACT_APP_WS_BASE=wss://api.opencine.cloud
   *
   * або залишити дефолт:
   *   https → wss://api.opencine.cloud
   *   http  → ws://localhost:8000  (для девелопменту)
   */
  getBackendWsBase() {
    // 👇 Найпростіший варіант:
    // якщо задано REACT_APP_WS_BASE — юзаємо його,
    // інакше — завжди api.opencine.cloud
    if (process.env.REACT_APP_WS_BASE) {
      return process.env.REACT_APP_WS_BASE;
    }
    return "wss://api.opencine.cloud";
  }

  getWsUrl() {
    if (!this.deviceId) {
      throw new Error("NestifyPlayerClient: deviceId is not set");
    }
    const base = this.getBackendWsBase().replace(/\/+$/, "");
    // бекенд-роут: /ws/control/{device_id}
    return `${base}/ws/control/${encodeURIComponent(this.deviceId)}`;
  }

  // ---------- INIT / WS ----------

  /**
   * Старий init() можна викликати як і раніше,
   * але тепер він просто намагається підключитись, якщо deviceId вже заданий.
   */
  init() {
    if (this.ws) return;
    if (!this.deviceId) {
      console.warn(
        "[NestifyPlayerClient] init() called but deviceId is not set yet"
      );
      return;
    }
    this.connect();
  }

  connect() {
    if (this.ws) {
      // вже є конект (open/closing) — не плодимо
      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        return;
      }
    }

    let url;
    try {
      url = this.getWsUrl();
    } catch (e) {
      console.warn("[NestifyPlayerClient] WS connect skipped:", e.message);
      this.scheduleReconnect();
      return;
    }

    let ws;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      console.error("[NestifyPlayerClient] WS create error:", e);
      this.scheduleReconnect();
      return;
    }

    this.ws = ws;

    ws.onopen = () => {
      console.log("[NestifyPlayerClient] WS connected:", url);
      this.isConnected = true;
      this.emit("connected", true);

      // одразу запросимо статус плеєра
      this.getStatusRpc().catch(() => {});
    };

    ws.onclose = (evt) => {
      console.warn(
        "[NestifyPlayerClient] WS closed:",
        evt.code,
        evt.reason || ""
      );
      this.isConnected = false;
      this.emit("connected", false);

      // відбиваємо всі "висячі" проміси
      this.pending.forEach(({ reject }) =>
        reject(new Error("WS closed before response"))
      );
      this.pending.clear();

      this.ws = null;

      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    };

    ws.onerror = (err) => {
      console.error("[NestifyPlayerClient] WS error:", err);
      this.emit("error", err);
    };

    ws.onmessage = (evt) => {
      this.handleMessage(evt.data);
    };
  }

  _cleanupSocket() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
        console.warn("[NestifyPlayerClient] close error:", e);
      }
      this.ws = null;
    }
    this.isConnected = false;
    this.pending.forEach(({ reject }) =>
      reject(new Error("WS reset before response"))
    );
    this.pending.clear();
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      // якщо deviceId ще є — пробуємо знову
      if (this.deviceId) {
        this.connect();
      }
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

    // нотифікації від плеєра
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

  // ---------- CONTROL ----------

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

  // ---------- PLAY ON TV ----------

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
