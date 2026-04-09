// hooks/useScrollCompactMode.js
import { useEffect, useRef, useState } from "react";

export default function useScrollCompactMode(
  enabled = true,
  topOffset = 80,
  threshold = 8
) {
  const [isCompact, setIsCompact] = useState(false);
  const lastYRef = useRef(0);
  const compactRef = useRef(false);
  const tickingRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      compactRef.current = false;
      setIsCompact(false);
      return;
    }
    lastYRef.current = window.scrollY;

    const onScroll = () => {
      const y = window.scrollY;
      if (tickingRef.current) return;
      tickingRef.current = true;

      window.requestAnimationFrame(() => {
        const diff = y - lastYRef.current;
        lastYRef.current = y;

        let next = compactRef.current;
        if (diff > threshold && y > topOffset) next = true; // скролим вниз → компакт
        if (diff < -threshold || y < topOffset) next = false; // вгору/вище offset → розгорнуто

        if (next !== compactRef.current) {
          compactRef.current = next;
          setIsCompact(next);
        }
        tickingRef.current = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [enabled, topOffset, threshold]);

  return isCompact;
}
