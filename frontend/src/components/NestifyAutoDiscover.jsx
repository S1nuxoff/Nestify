// src/components/NestifyAutoDiscover.jsx
import React, { useEffect, useState, useCallback } from "react";
import nestifyPlayerClient from "../api/ws/nestifyPlayerClient";
import "../styles/NestifyAutoDiscover.css";

// ✅ тут міняємо endpoint на /setting
async function probeIp(ip, timeoutMs = 600) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(`http://${ip}:8888/setting`, {
      mode: "cors",
      signal: controller.signal,
    });

    if (!resp.ok) return null;

    const json = await resp.json();
    return { ip, json };
  } catch (_) {
    return null;
  } finally {
    clearTimeout(id);
  }
}

const NestifyAutoDiscover = () => {
  const [foundBaseUrl, setFoundBaseUrl] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // 1) якщо вже збережений девайс – одразу підключаємось
      const savedHttp = localStorage.getItem("nestify_player_http");
      if (savedHttp && typeof nestifyPlayerClient.setBaseUrl === "function") {
        nestifyPlayerClient.setBaseUrl(savedHttp);
      }

      // 2) готуємо список підмереж
      const host = window.location.hostname; // напр. 10.19.202.73
      const ipRegex = /^\d+\.\d+\.\d+\.\d+$/;

      const subnets = new Set();

      if (ipRegex.test(host)) {
        const [a, b, c] = host.split(".");
        subnets.add(`${a}.${b}.${c}`); // 10.19.202.*
      } else {
        // fallback – типові домашні
        subnets.add("192.168.0");
        subnets.add("192.168.1");
        subnets.add("10.0.0");
        subnets.add("10.0.1");
      }

      const ips = [];
      for (const subnet of subnets) {
        for (let i = 2; i <= 254; i++) {
          ips.push(`${subnet}.${i}`);
        }
      }

      // 3) кроками по 8 IP
      for (let i = 0; i < ips.length; i += 8) {
        if (cancelled) return;
        const batch = ips.slice(i, i + 8);

        const results = await Promise.all(batch.map((ip) => probeIp(ip)));
        const hit = results.find(Boolean);

        if (hit) {
          if (cancelled) return;

          const baseUrl = `http://${hit.ip}:8888`;

          const prev = localStorage.getItem("nestify_player_http");
          if (prev && prev === baseUrl) {
            // той самий девайс – просто конект
            if (typeof nestifyPlayerClient.setBaseUrl === "function") {
              nestifyPlayerClient.setBaseUrl(baseUrl);
            }
          } else {
            // новий девайс – показуємо банер
            setFoundBaseUrl(baseUrl);
            setShowPrompt(true);
          }

          return;
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleConnect = useCallback(() => {
    if (!foundBaseUrl) return;
    // зберігаємо саме те, що читає клієнт (LS_HTTP_KEY)
    localStorage.setItem("nestify_player_http", foundBaseUrl);
    if (typeof nestifyPlayerClient.setBaseUrl === "function") {
      nestifyPlayerClient.setBaseUrl(foundBaseUrl);
    }
    setShowPrompt(false);
  }, [foundBaseUrl]);

  const handleDismiss = useCallback(() => {
    setShowPrompt(false);
  }, []);

  if (!showPrompt || !foundBaseUrl) return null;

  return (
    <div className="nestify-discover-banner">
      <div className="nestify-discover-banner__inner">
        <div className="nestify-discover-banner__text">
          <div className="nestify-discover-banner__title">
            Знайдено Nestify Player
          </div>
          <div className="nestify-discover-banner__subtitle">
            {foundBaseUrl.replace("http://", "")}
          </div>
        </div>

        <div className="nestify-discover-banner__actions">
          <button
            className="nestify-discover-banner__btn nestify-discover-banner__btn--secondary"
            onClick={handleDismiss}
          >
            Ні
          </button>
          <button
            className="nestify-discover-banner__btn nestify-discover-banner__btn--primary"
            onClick={handleConnect}
          >
            Підключити
          </button>
        </div>
      </div>
    </div>
  );
};

export default NestifyAutoDiscover;
