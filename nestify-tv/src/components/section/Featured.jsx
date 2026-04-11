// src/components/section/Featured.jsx
import React, { useRef, useState, useCallback, useEffect } from "react";
import FeaturedCard from "../ui/FeaturedCard";
import { findNearest, scrollRowToTop } from "../../utils/spatialNav";
import "../../styles/Featured.css";

function Featured({ onMovieSelect, featured, onActiveIndexChange }) {
  const scrollRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const itemsRef = useRef([]);
  const observerRef = useRef(null);

  // Track which slide is visible via IntersectionObserver
  useEffect(() => {
    if (!scrollRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.dataset.index);
            setActiveIndex(idx);
            onActiveIndexChange?.(idx);
          }
        });
      },
      { root: scrollRef.current, threshold: 0.5 }
    );

    itemsRef.current.forEach((el) => {
      if (el) observerRef.current.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, [featured, onActiveIndexChange]);

  const goTo = useCallback((idx) => {
    const el = itemsRef.current[idx];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
  }, []);

  // Focus the .fh-hero inside a slide
  const focusSlide = useCallback((idx) => {
    requestAnimationFrame(() => {
      const hero = itemsRef.current[idx]?.querySelector(".fh-hero");
      hero?.focus({ preventScroll: true });
    });
  }, []);

  // Jump focus down to the first visible element in the row below
  const jumpDown = useCallback((fromEl) => {
    const next = findNearest(fromEl, "down");
    if (next) {
      next.focus({ preventScroll: true });
      scrollRowToTop(next); // no horizontal snap — preserve the row's scroll state
    }
  }, []);

  // D-pad inside featured area
  const handleKeyDown = useCallback((e) => {
    const isLeft = e.key === "ArrowLeft";
    const isRight = e.key === "ArrowRight";
    if (!isLeft && !isRight) return; // let ArrowUp/Down propagate to global spatial nav

    e.preventDefault();
    e.stopPropagation(); // prevent global spatial nav from also firing

    const total = featured?.length ?? 1;

    if (isRight) {
      if (activeIndex < total - 1) {
        // Advance to next slide
        const next = activeIndex + 1;
        setActiveIndex(next);
        goTo(next);
        focusSlide(next);
      } else {
        // At last slide → jump down to next row
        const hero = itemsRef.current[activeIndex]?.querySelector(".fh-hero");
        if (hero) jumpDown(hero);
      }
    }

    if (isLeft) {
      if (activeIndex > 0) {
        // Go back to previous slide
        const prev = activeIndex - 1;
        setActiveIndex(prev);
        goTo(prev);
        focusSlide(prev);
      } else {
        // At first slide + Left → open sidebar
        window.dispatchEvent(new CustomEvent("tv:open-sidebar"));
      }
    }
  }, [activeIndex, featured?.length, goTo, focusSlide, jumpDown]);

  if (!featured?.length) return null;

  return (
    <div className="ft-root" onKeyDown={handleKeyDown}>
      <div className="ft-scroll" ref={scrollRef}>
        {featured.map((movie, idx) => (
          <div
            key={`${movie.id}-${idx}`}
            className="ft-slide"
            data-index={idx}
            ref={(el) => (itemsRef.current[idx] = el)}
          >
            <FeaturedCard
              movie={movie}
              onMovieSelect={onMovieSelect}
              isActive={idx === activeIndex}
              resetTrigger={idx === activeIndex ? activeIndex : null}
            />
          </div>
        ))}
      </div>

      {/* Pagination bullets — tabIndex=-1 so D-pad skips them */}
      {featured.length > 1 && (
        <div className="ft-bullets">
          {featured.map((_, idx) => (
            <button
              key={idx}
              tabIndex={-1}
              className={`ft-bullet${idx === activeIndex ? " ft-bullet--active" : ""}`}
              onClick={() => goTo(idx)}
              aria-label={`Слайд ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default Featured;
