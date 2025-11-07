// hooks/useLiveSession.js
import { useState, useEffect } from "react";
import config from "../core/config";

const useLiveSession = (userId) => {
  const [session, setSession] = useState(null);

  useEffect(() => {
    if (!userId) return;

    const ws = new WebSocket(`${config.backend_ws}/ws/live_session/${userId}`);

    ws.onopen = () => {
      console.log("[live_session] WS open");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("[live_session] message:", data);
        setSession(data.live_session || null);
      } catch (err) {
        console.error("WS parse error:", err);
      }
    };

    ws.onerror = (e) => {
      console.error("[live_session] WS error", e);
    };

    ws.onclose = (e) => {
      console.warn("[live_session] WS closed", e.code, e.reason);
    };

    // ❌ НІЧОГО НЕ ЗАКРИВАЄМО ВРУЧНУ
    return () => {
      // ws.close();  // прибираємо
    };
  }, [userId]);

  return session;
};

export default useLiveSession;
