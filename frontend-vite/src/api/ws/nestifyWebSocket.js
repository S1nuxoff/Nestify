// src/api/ws/nestifyWebSocket.js
import config from "../../core/config";

class Emitter {
  /* как у тебя было */
}

const emitter = new Emitter();

const nestifyWebSocket = {
  ws: null,
  isConnected: false,
  nextId: 1,
  httpBaseUrl: null,

  _attachHandlers(wsUrl) {
    console.log("[Nestify WS] Connecting to:", wsUrl);
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log("[Nestify WS] Connected");
      this.isConnected = true;

      if (!this.httpBaseUrl) {
        try {
          const u = new URL(this.ws.url);
          const httpProto = u.protocol === "wss:" ? "https:" : "http:";
          this.httpBaseUrl = `${httpProto}//${u.hostname}:8888`;
        } catch (e) {
          console.error(
            "[nestifyWebSocket] cannot derive httpBaseUrl from ws.url",
            e
          );
        }
      }

      emitter.emit("connected", true);
    };

    this.ws.onclose = () => {
      console.log("[Nestify WS] Disconnected");
      this.isConnected = false;
      emitter.emit("connected", false);
      this.ws = null;
    };

    this.ws.onerror = (err) => {
      console.error("[Nestify WS] Error:", err);
    };

    this.ws.onmessage = (event) => {
      let obj;
      try {
        obj = JSON.parse(event.data);
      } catch (e) {
        console.error("[Nestify WS] bad JSON:", e);
        return;
      }

      if (obj.id && Object.prototype.hasOwnProperty.call(obj, "result")) {
        emitter.emit("rpcResponse", obj);
      }

      if (obj.method) {
        emitter.emit("notification", obj);

        if (
          obj.params &&
          obj.params.data &&
          typeof obj.params.data === "object"
        ) {
          if (
            obj.method === "Player.OnPlay" ||
            obj.method === "Player.OnPause" ||
            obj.method === "Player.OnStop" ||
            obj.method === "Player.OnSeek" ||
            obj.method === "Player.OnProgress"
          ) {
            emitter.emit("status", obj.params.data);
          }
        }
      }
    };
  },

  init() {
    if (this.ws) return;

    let wsUrl = null;

    if (config.player_url) {
      try {
        const u = new URL(config.player_url); // напр. http://192.168.0.44:8888
        const wsProto = u.protocol === "https:" ? "wss:" : "ws:";
        const host = u.hostname;

        wsUrl = `${wsProto}//${host}:8889`;
        this.httpBaseUrl = `${u.protocol}//${host}:8888`;
      } catch (e) {
        console.error("[nestifyWebSocket] bad config.player_url:", e);
      }
    }

    if (!wsUrl) {
      console.warn(
        "[nestifyWebSocket] WS URL не налаштовано (config.player_url порожній)"
      );
      return;
    }

    this._attachHandlers(wsUrl);
  },

  // 🔥 НОВЕ: встановити базовий URL, який ми знайшли сканером
  setBaseUrl(httpBaseUrl) {
    try {
      const u = new URL(httpBaseUrl); // типу http://192.168.0.44:8888
      const wsProto = u.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${wsProto}//${u.hostname}:8889`;

      this.httpBaseUrl = `${u.protocol}//${u.hostname}:8888`;

      if (this.ws) {
        try {
          this.ws.close();
        } catch (e) {}
        this.ws = null;
      }

      this._attachHandlers(wsUrl);
    } catch (e) {
      console.error("[nestifyWebSocket] bad base url in setBaseUrl:", e);
    }
  },

  sendRpc(method, params = {}, id = null) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("[nestifyWebSocket] WS not connected, cannot send RPC");
      return;
    }
    const rpcId = id ?? this.nextId++;
    const payload = {
      jsonrpc: "2.0",
      id: rpcId,
      method,
      params,
    };
    this.ws.send(JSON.stringify(payload));
    return rpcId;
  },

  playPause() {
    this.sendRpc("Player.PlayPause", {});
  },
  stop() {
    this.sendRpc("Player.Stop", {});
  },
  seek(positionMs) {
    this.sendRpc("Player.Seek", { position_ms: positionMs });
  },
  setVolume(volume) {
    this.sendRpc("Application.SetVolume", { volume });
  },
  getStatus() {
    return this.sendRpc("Player.GetStatus", {});
  },

  on(eventName, cb) {
    emitter.on(eventName, cb);
  },
  off(eventName, cb) {
    emitter.off(eventName, cb);
  },
};

export default nestifyWebSocket;
