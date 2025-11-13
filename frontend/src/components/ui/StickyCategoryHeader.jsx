// src/components/ui/StickyCategoryHeader.jsx
import React, { useState, useEffect, useRef } from "react";
import { ReactComponent as BackIcon } from "../../assets/icons/back.svg";

import "../../styles/StickyCategoryHeader.css";

const StickyCategoryHeader = ({
  title,
  onBack,
  showScrollTop = true,
  stickyBreakpoint = 1650,
}) => {
  const rowRef = useRef(null);
  const [isStuck, setIsStuck] = useState(false);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;

    const STICKY_OFFSET = 32; // логика та же

    const isSmallScreen = () => window.innerWidth < stickyBreakpoint;
    let enabled = isSmallScreen();

    const handleScroll = () => {
      if (!enabled) {
        if (isStuck) setIsStuck(false);
        return;
      }

      const rect = el.getBoundingClientRect();
      const stuckNow = rect.top <= STICKY_OFFSET;
      setIsStuck(stuckNow);
    };

    const handleResize = () => {
      enabled = isSmallScreen();
      handleScroll();
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, [isStuck, stickyBreakpoint]);

  const handleScrollTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <div
      ref={rowRef}
      className={
        "explorer-header-row" + (isStuck ? " explorer-header-row--stuck" : "")
      }
    >
      <div
        className={
          "category-content-title" +
          (isStuck ? " category-content-title--stuck" : "")
        }
      >
        <BackIcon className="category-back-btn" onClick={onBack} />
        <span className="row-header-title">{title}</span>
      </div>

      {showScrollTop && (
        <button
          type="button"
          className={
            "category-scroll-top-circle" +
            (isStuck ? " category-scroll-top-circle--visible" : "")
          }
          onClick={handleScrollTop}
          aria-label="Прокрутить наверх"
        >
          <BackIcon className="category-scroll-top-icon" />
        </button>
      )}
    </div>
  );
};

export default StickyCategoryHeader;
