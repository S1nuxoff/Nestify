// src/api/ws/kodiWebSocket.js
import config from "../../core/config";
import { deleteSession } from "../../api/session";

class Emitter {
  constructor() {
    this.handlers = {};
  }
  on(eventName, callback) {
    if (!this.handlers[eventName]) {
      this.handlers[eventName] = [];
    }
    this.handlers[eventName].push(callback);
  }
  off(eventName, callback) {
    if (!this.handlers[eventName]) return;
    this.handlers[eventName] = this.handlers[eventName].filter(
      (cb) => cb !== callback
    );
  }
  emit(eventName, data) {
    if (!this.handlers[eventName]) return;
    this.handlers[eventName].forEach((cb) => cb(data));
  }
}

const emitter = new Emitter();
const API_BASE = config.backend_url;

function safeGetCurrentUser() {
  try {
    const raw = localStorage.getItem("current_user");
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error("[kodiWebSocket] bad current_user in localStorage", e);
    return null;
  }
}

// нормалізуємо адресу: додаємо ws:// і /jsonrpc за потреби
function normalizeKodiUrl(raw) {
  if (!raw) return null;
  let url = raw.trim();

  // якщо немає протоколу — додаємо ws://
  if (!/^wss?:\/\//i.test(url)) {
    url = "ws://" + url;
  }

  // якщо немає /jsonrpc в кінці — додаємо
  if (!/jsonrpc\/?$/i.test(url)) {
    url = url.replace(/\/+$/g, "") + "/jsonrpc";
  }

  return url;
}

// тягнемо юзерів з БД через /api/v1/utils/users
async function fetchKodiAddressForCurrentUser() {
  const user = safeGetCurrentUser();
  if (!user?.id) return null;

  try {
    const res = await fetch(`${API_BASE}/api/v1/utils/users`);
    if (!res.ok) {
      console.warn("[kodiWebSocket] failed to load users from API");
      return null;
    }
    const data = await res.json(); // очікуємо масив юзерів
    const found = Array.isArray(data)
      ? data.find((u) => u.id === user.id)
      : null;
    return found?.kodi_address || null;
  } catch (e) {
    console.error("[kodiWebSocket] error loading users:", e);
    return null;
  }
}

const kodiWebSocket = {
  ws: null,
  isConnected: false,
  playerId: null,
  reconnectAttempts: 0,

  async init() {
    if (this.ws) {
      console.warn("[kodiWebSocket] Already initialized!");
      return;
    }

    // 1) беремо адресу з БД
    const kodiFromDb = await fetchKodiAddressForCurrentUser();

    // 2) якщо в БД нема — fallback на конфіг
    const rawUrl = kodiFromDb || config.kodi_url || null;
    const url = normalizeKodiUrl(rawUrl);

    if (!url) {
      console.warn(
        "[kodiWebSocket] Kodi URL is not set (no kodi_address in DB and no config.kodi_url)"
      );
      return;
    }

    console.log("[Kodi WS] Connecting to:", url);
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log("[Kodi WS] Connected!");
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.requestActivePlayer();
      this.requestVolume();
      emitter.emit("connected", true);
    };

    this.ws.onclose = () => {
      console.log("[Kodi WS] Disconnected.");
      this.isConnected = false;
      emitter.emit("connected", false);
      this.ws = null;

      const delay = 5000 * Math.pow(2, this.reconnectAttempts);
      this.reconnectAttempts = this.reconnectAttempts + 1;
      console.log(
        `[Kodi WS] Attempting to reconnect in ${delay / 1000} seconds...`
      );
      setTimeout(() => {
        this.init();
      }, delay);
    };

    this.ws.onerror = (err) => {
      console.error("[Kodi WS] Error:", err);
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.id) {
          this.handleResponse(data);
        } else if (data.method) {
          this.handleNotification(data);
        }
      } catch (err) {
        console.error("Failed to parse Kodi response:", err);
      }
    };
  },

  handleResponse(data) {
    if (data.id === 101 && data.result) {
      if (data.result.length > 0) {
        this.playerId = data.result[0].playerid;
      } else {
        this.playerId = null;
      }
      emitter.emit("playerIdChange", this.playerId);
    } else if (data.id === 102 && data.result) {
      emitter.emit("playerProperties", data.result);
    } else if (data.id === 230 && data.result) {
      emitter.emit("applicationProperties", data.result);
    }

    if (data.id === 500 && data.result) {
      emitter.emit("moviesList", data.result.movies || []);
    }
    if (data.id === 501 && data.result) {
      emitter.emit("directoryList", data.result.files || []);
    }
  },

  handleNotification(data) {
    console.log("[Kodi Notification]", data.method, data.params);

    if (data.method === "Player.OnStop") {
      this.playerId = null;
      emitter.emit("playerIdChange", this.playerId);

      const user = safeGetCurrentUser();
      if (user?.id) {
        deleteSession(user.id)
          .then(() => {
            console.log("Session removal notified successfully.");
          })
          .catch((error) => {
            console.error("Error notifying session removal:", error);
          });
      }
    }

    if (data.method === "Player.OnPlay") {
      console.log("Player.OnPlay event received, requesting active player...");
      this.requestActivePlayer();
    }

    emitter.emit("notification", data);
  },

  sendJsonRpc(method, params = {}, requestId = 1) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("[kodiWebSocket] WebSocket not connected.");
      return;
    }
    const message = {
      jsonrpc: "2.0",
      id: requestId,
      method,
      params,
    };
    this.ws.send(JSON.stringify(message));
  },

  requestActivePlayer() {
    this.sendJsonRpc("Player.GetActivePlayers", {}, 101);
  },

  requestPlayerProperties(playerId) {
    const params = {
      playerid: playerId,
      properties: ["time", "totaltime", "speed", "percentage", "position"],
    };
    this.sendJsonRpc("Player.GetProperties", params, 102);
  },

  requestVolume() {
    this.sendJsonRpc(
      "Application.GetProperties",
      { properties: ["volume"] },
      230
    );
  },

  playPause() {
    if (this.playerId !== null) {
      this.sendJsonRpc("Player.PlayPause", { playerid: this.playerId }, 200);
    }
  },

  seek(seconds) {
    if (this.playerId !== null) {
      this.sendJsonRpc(
        "Player.Seek",
        { playerid: this.playerId, value: { seconds } },
        201
      );
    }
  },

  seekAbsolute(hours, minutes, seconds) {
    if (this.playerId !== null) {
      this.sendJsonRpc(
        "Player.Seek",
        {
          playerid: this.playerId,
          value: { time: { hours, minutes, seconds } },
        },
        202
      );
    }
  },

  getMovies() {
    this.sendJsonRpc(
      "VideoLibrary.GetMovies",
      {
        properties: ["title", "year", "thumbnail", "file", "runtime"],
      },
      500
    );
  },

  getDirectory(path) {
    this.sendJsonRpc(
      "Files.GetDirectory",
      {
        directory: path,
        media: "video",
      },
      501
    );
  },

  openFile(url) {
    this.sendJsonRpc(
      "Player.Open",
      {
        item: { file: url },
      },
      300
    );
  },

  stop() {
    if (this.playerId !== null) {
      this.sendJsonRpc("Player.Stop", { playerid: this.playerId }, 210);
    }
  },

  setVolume(volume) {
    this.sendJsonRpc("Application.SetVolume", { volume }, 220);
  },

  on(eventName, cb) {
    emitter.on(eventName, cb);
  },
  off(eventName, cb) {
    emitter.off(eventName, cb);
  },
};

const waitForPlayerOnPlay = (timeout = 4000) => {
  return new Promise((resolve, reject) => {
    let timer = null;

    const handler = (data) => {
      if (data.method === "Player.OnPlay") {
        clearTimeout(timer);
        kodiWebSocket.off("notification", handler);
        resolve(true);
      }
    };

    kodiWebSocket.on("notification", handler);

    timer = setTimeout(() => {
      kodiWebSocket.off("notification", handler);
      reject(new Error("Kodi не начал воспроизведение"));
    }, timeout);
  });
};

export default kodiWebSocket;
export { waitForPlayerOnPlay };
