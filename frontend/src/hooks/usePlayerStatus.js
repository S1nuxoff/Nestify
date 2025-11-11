// src/hooks/usePlayerStatus.js
import { useEffect, useState } from "react";
import nestifyPlayerClient from "../api/ws/nestifyPlayerClient";

export default function usePlayerStatus() {
  const [status, setStatus] = useState(() => nestifyPlayerClient.getStatus());

  useEffect(() => {
    const handler = (st) => {
      setStatus({ ...(st || {}) }); // новий об'єкт, щоб реакція точно оновилась
    };

    nestifyPlayerClient.on("status", handler);

    // якщо вже є збережений статус — одразу віддати
    const current = nestifyPlayerClient.getStatus();
    if (current) {
      setStatus({ ...current });
    }

    return () => {
      nestifyPlayerClient.off("status", handler);
    };
  }, []);

  return { status };
}
