import React, { useMemo, useCallback, useId, useState, useEffect } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { FreeMode, Navigation } from "swiper/modules";
import { useNavigate } from "react-router-dom";
import { ReactComponent as ArrowRightIcon } from "../../assets/icons/arrow-right.svg";
import { ReactComponent as MoreIcon } from "../../assets/icons/more.svg";

import "swiper/css";
import "swiper/css/free-mode";
import "swiper/css/navigation";
import "../../styles/ContentRowSwiper.css";

/** Разбивает массив на N "рядов", сохраняя порядок. */
function splitIntoRows(items, rows) {
  if (!rows || rows <= 1) return [items];
  const perRow = Math.ceil(items.length / rows);
  const result = [];
  for (let i = 0; i < rows; i++) {
    const start = i * perRow;
    const end = start + perRow;
    const slice = items.slice(start, end);
    if (slice.length) result.push(slice);
  }
  return result;
}

/** Один горизонтальный ряд с ленивой дозагрузкой слайдов */
function RowSwiper({
  rowItems,
  rowIndex,
  instanceId,
  CardComponent,
  cardProps,
}) {
  const INITIAL_CHUNK = 16;
  const CHUNK_SIZE = 16;
  const PRELOAD_THRESHOLD = 6; // за сколько слайдов до конца подгружать ещё

  const [visibleCount, setVisibleCount] = useState(() =>
    Math.min(rowItems.length, INITIAL_CHUNK)
  );

  // если изменился список элементов ряда — сбрасываем видимую пачку
  useEffect(() => {
    setVisibleCount(Math.min(rowItems.length, INITIAL_CHUNK));
  }, [rowItems, rowItems.length]);

  const itemsToRender = useMemo(
    () => rowItems.slice(0, visibleCount),
    [rowItems, visibleCount]
  );

  const rowKey = `${instanceId}-${rowIndex}`;
  const prevCls = `crs-prev-${rowKey}`;
  const nextCls = `crs-next-${rowKey}`;

  const handleSlideChange = useCallback(
    (swiper) => {
      const { activeIndex } = swiper;

      if (
        activeIndex >= visibleCount - PRELOAD_THRESHOLD &&
        visibleCount < rowItems.length
      ) {
        setVisibleCount((prev) => Math.min(prev + CHUNK_SIZE, rowItems.length));
      }
    },
    [visibleCount, rowItems.length]
  );

  if (!itemsToRender.length) return null;

  return (
    <div
      className="content-row__swiper-wrap"
      style={{ marginTop: rowIndex === 0 ? "24px" : "32px" }}
    >
      {/* стрелки для desktop */}
      <button
        className={`crs-nav-btn crs-nav-prev ${prevCls}`}
        aria-label="Previous"
      >
        ‹
      </button>
      <button
        className={`crs-nav-btn crs-nav-next ${nextCls}`}
        aria-label="Next"
      >
        ›
      </button>

      <Swiper
        className="movie_card_swiper"
        modules={[FreeMode, Navigation]}
        freeMode
        grabCursor
        slidesPerView="auto"
        navigation={{
          prevEl: `.${prevCls}`,
          nextEl: `.${nextCls}`,
        }}
        onSlideChange={handleSlideChange}
        watchSlidesProgress={false}
        observer={false}
        observeParents={false}
        breakpoints={{
          0: { spaceBetween: 8 },
          530: { spaceBetween: 16 },
        }}
      >
        {itemsToRender.map((item, index) => {
          const key =
            item.id || item.filmId || item.link || `${rowIndex}-${index}`;

          const cardSpecificProps =
            CardComponent?.name === "CollectionCard"
              ? { collection: item }
              : { movie: item };

          return (
            <SwiperSlide key={key}>
              <div className="card-appear" style={{ "--stagger-index": index }}>
                <CardComponent {...cardProps} {...cardSpecificProps} />
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>
    </div>
  );
}

const ContentRowSwiper = ({
  data = [],
  title,
  navigate_to = "",
  CardComponent,
  cardProps = {},
  navPrefix = "",
  rows = 1,
}) => {
  const navigate = useNavigate();
  const instanceIdRaw = useId();
  const instanceId = instanceIdRaw.replace(/[:]/g, "");

  const rowsData = useMemo(() => splitIntoRows(data || [], rows), [data, rows]);

  const handleNavigate = useCallback(
    (e) => {
      e.stopPropagation();
      if (!navigate_to) return;
      navigate(`${navPrefix}${navigate_to}`);
    },
    [navigate, navPrefix, navigate_to]
  );

  if (!data || data.length === 0 || rowsData.length === 0) return null;

  return (
    <div className="content-row__container">
      <div className="content-row__top">
        <div className="content-row__top-title" onClick={handleNavigate}>
          <span className="row-header-title">{title}</span>
          <ArrowRightIcon className="arrow-right-icon" />
        </div>
        <div className="content-row__top-action" onClick={handleNavigate}>
          <MoreIcon />
        </div>
      </div>

      <div className="content-row__swipers">
        {rowsData.map((rowItems, rowIndex) => (
          <RowSwiper
            key={rowIndex}
            rowItems={rowItems}
            rowIndex={rowIndex}
            instanceId={instanceId}
            CardComponent={CardComponent}
            cardProps={cardProps}
          />
        ))}
      </div>
    </div>
  );
};

const areEqual = (prev, next) => {
  return (
    prev.data === next.data &&
    prev.title === next.title &&
    prev.navigate_to === next.navigate_to &&
    prev.navPrefix === next.navPrefix &&
    prev.rows === next.rows &&
    prev.CardComponent === next.CardComponent &&
    JSON.stringify(prev.cardProps) === JSON.stringify(next.cardProps)
  );
};

export default React.memo(ContentRowSwiper, areEqual);
