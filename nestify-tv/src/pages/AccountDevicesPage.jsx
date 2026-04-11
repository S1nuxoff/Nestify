import React, { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ChevronLeft, Loader2, Plus, Trash2, Tv } from "lucide-react";
import { getAuthToken, hasAccountSession } from "../core/session";
import config from "../core/config";
import "../styles/AccountSettingsPage.css";

export default function AccountDevicesPage() {
  const navigate = useNavigate();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState(null);

  const loadDevices = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${config.backend_url}/api/v3/tv/devices`, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch TV devices");
      const data = await res.json();
      setDevices(Array.isArray(data) ? data : []);
    } catch {
      setDevices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  if (!hasAccountSession()) return <Navigate to="/auth/login" replace />;

  const formatDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString("uk-UA", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusLabel = (device) => {
    if (device.online) {
      return {
        text: "Онлайн",
        color: "#30D158",
        bg: "rgba(48,209,88,0.15)",
      };
    }
    if (!device.is_logged_in) {
      return {
        text: "Вийшов",
        color: "#ffb020",
        bg: "rgba(255,176,32,0.16)",
      };
    }
    return {
      text: "Офлайн",
      color: "rgba(255,255,255,0.5)",
      bg: "rgba(255,255,255,0.08)",
    };
  };

  const handleDisconnect = async (deviceId) => {
    try {
      setRemovingId(deviceId);
      const res = await fetch(
        `${config.backend_url}/api/v3/tv/unregister?device_id=${encodeURIComponent(deviceId)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${getAuthToken()}`,
          },
        }
      );
      if (!res.ok) throw new Error("Failed to remove TV device");
      await loadDevices();
    } catch {
      setRemovingId(null);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="acc-root" style={{ paddingBottom: 100 }}>
      <div
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          marginBottom: 28,
          position: "relative",
        }}
      >
        <button className="acc-back-btn" onClick={() => navigate(-1)}>
          <ChevronLeft size={20} />
        </button>
        <h1
          className="acc-title"
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            margin: 0,
          }}
        >
          Пристрої
        </h1>
      </div>

      <p
        style={{
          alignSelf: "flex-start",
          fontSize: 12,
          color: "rgba(255,255,255,0.35)",
          fontWeight: 400,
          marginBottom: 8,
          paddingLeft: 4,
        }}
      >
        Підключені пристрої
      </p>

      {loading ? (
        <div
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "center",
            padding: "36px 0",
          }}
        >
          <Loader2
            size={22}
            style={{
              animation: "spin 0.8s linear infinite",
              color: "rgba(255,255,255,0.5)",
            }}
          />
        </div>
      ) : devices.length > 0 ? (
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {devices.map((device) => {
            const status = getStatusLabel(device);
            return (
              <div
                key={device.device_id}
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 16,
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "14px 16px",
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      background: "rgba(255,255,255,0.07)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Tv size={20} color="#fff" />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <p style={{ fontSize: 15, color: "#fff", margin: 0 }}>
                        {device.device_name || "Телевізор"}
                      </p>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11,
                          fontWeight: 500,
                          padding: "2px 7px",
                          borderRadius: 20,
                          background: status.bg,
                          color: status.color,
                        }}
                      >
                        <span
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            background: status.color,
                            flexShrink: 0,
                          }}
                        />
                        {status.text}
                      </span>
                    </div>

                    <p
                      style={{
                        fontSize: 13,
                        color: "rgba(255,255,255,0.5)",
                        margin: "4px 0 0",
                      }}
                    >
                      Профіль: {device.profile_name}
                    </p>

                    {formatDate(device.last_seen_at || device.logged_out_at) && (
                      <p
                        style={{
                          fontSize: 12,
                          color: "rgba(255,255,255,0.32)",
                          margin: "4px 0 0",
                        }}
                      >
                        Остання активність:{" "}
                        {formatDate(device.last_seen_at || device.logged_out_at)}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleDisconnect(device.device_id)}
                    disabled={removingId === device.device_id}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 6,
                      color: "rgba(255,255,255,0.3)",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    {removingId === device.device_id ? (
                      <Loader2
                        size={18}
                        style={{ animation: "spin 0.8s linear infinite" }}
                      />
                    ) : (
                      <Trash2 size={18} />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.05)",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.07)",
            padding: "24px 16px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Tv size={32} color="rgba(255,255,255,0.2)" />
          <p
            style={{
              fontSize: 14,
              color: "rgba(255,255,255,0.35)",
              margin: 0,
              textAlign: "center",
            }}
          >
            Немає підключених пристроїв
          </p>
        </div>
      )}

      <button
        onClick={() => navigate("/connect")}
        style={{
          marginTop: 16,
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "13px 16px",
          borderRadius: 14,
          border: "1.5px dashed rgba(255,255,255,0.15)",
          background: "transparent",
          color: "rgba(255,255,255,0.5)",
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        <Plus size={16} />
        Підключити ТВ
      </button>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
