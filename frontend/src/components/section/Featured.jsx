// src/components/section/Featured.jsx
import React, { useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";

import FeaturedCard from "../ui/FeaturedCard";

// если не подключено глобально
import "swiper/css";
import "swiper/css/pagination";

function Featured({ onMovieSelect, featured, onActiveIndexChange }) {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <Swiper
      modules={[Pagination]}
      pagination={{
        clickable: true,
        dynamicBullets: true,
      }}
      onSlideChange={(swiper) => {
        setActiveIndex(swiper.activeIndex);
        onActiveIndexChange?.(swiper.activeIndex);
      }}
      slidesPerView={1}
      spaceBetween={10}
      speed={450}
      threshold={8}
      resistanceRatio={0.85}
      watchSlidesProgress
      observer
      observeParents
      passiveListeners
      touchStartPreventDefault={false}
      className="player-swiper"
    >
      {featured?.map((movie, idx) => (
        <SwiperSlide key={`${movie.id}-${idx}`}>
          <FeaturedCard
            movie={movie}
            onMovieSelect={onMovieSelect}
            isActive={idx === activeIndex}
            resetTrigger={idx === activeIndex ? activeIndex : null}
          />
        </SwiperSlide>
      ))}
    </Swiper>
  );
}

export default Featured;
