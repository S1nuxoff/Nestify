import { useEffect, useState } from "react";
import {
  getAuthToken,
  getCurrentProfile,
  hasAccountSession,
  hasSelectedProfile,
} from "../core/session";
import { isAndroidBridge } from "../api/AndroidBridge";
import config from "../core/config";

export function useTvDevice(pollIntervalMs = 30000) {
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAndroidBridge()) {
      setDevice(null);
      setLoading(false);
      return;
    }

    if (!hasAccountSession() || !hasSelectedProfile()) {
      setDevice(null);
      setLoading(false);
      return;
    }

    const profile = getCurrentProfile();
    if (!profile?.id) {
      setDevice(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch(`${config.backend_url}/api/v3/tv/devices`, {
          headers: {
            Authorization: `Bearer ${getAuthToken()}`,
          },
        });

        if (!res.ok || cancelled) return;

        const devices = await res.json();
        const match = devices.find(
          (item) =>
            item.profile_id === profile.id &&
            item.is_logged_in &&
            item.online
        );

        if (!cancelled) {
          setDevice(match || null);
        }
      } catch {
        if (!cancelled) {
          setDevice(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    check();
    const interval = setInterval(check, pollIntervalMs);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pollIntervalMs]);

  return { device, loading };
}
