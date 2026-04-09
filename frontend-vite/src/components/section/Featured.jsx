// src/components/section/Featured.jsx
import React, { useRef, useState, useCallback, useEffect } from "react";
import FeaturedCard from "../ui/FeaturedCard";
import "../../styles/Featured.css";

function Featured({ onMovieSelect, featured, onActiveIndexChange }) {
  const scrollRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const itemsRef = useRef([]);
  const observerRef = useRef(null);

  // IntersectionObserver to track which slide is visible
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
      {
        root: scrollRef.current,
        threshold: 0.5,
      }
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

  if (!featured?.length) return null;

  return (
    <div className="ft-root">
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

      {/* Pagination bullets */}
      {featured.length > 1 && (
        <div className="ft-bullets">
          {featured.map((_, idx) => (
            <button
              key={idx}
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
