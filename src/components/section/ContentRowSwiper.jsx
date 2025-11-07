import React from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { useNavigate } from "react-router-dom";
import { ReactComponent as ArrowRightIcon } from "../../assets/icons/arrow-right.svg";
import { ReactComponent as MoreIcon } from "../../assets/icons/more.svg";
import "swiper/css";
import "../../styles/ContentRowSwiper.css";

/**
 * Разбивает массив на N "рядов", сохраняя порядок.
 */
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

/**
 * Универсальный Swiper для отображения карточек.
 *
 * @param {Array} data - Массив данных (фильмы, коллекции, история и т.д.)
 * @param {string} title - Заголовок ряда
 * @param {string} navigate_to - Куда переходить по клику на заголовок/иконку
 * @param {React.Component} CardComponent - Компонент карточки (например, CollectionCard или MediaCard)
 * @param {Object} cardProps - Дополнительные пропсы для карточки (например, type, onMovieSelect и т.д.)
 * @param {string} navPrefix - Необязательно. Префикс для пути (например, "/category")
 * @param {number} rows - Количество вертикальных рядов (1 по умолчанию)
 */
function ContentRowSwiper({
  data = [],
  title,
  navigate_to = "",
  CardComponent,
  cardProps = {},
  navPrefix = "",
  rows = 1,
}) {
  const navigate = useNavigate();

  const rowsData = splitIntoRows(data, rows);

  const handleNavigate = (e) => {
    e.stopPropagation();
    if (!navigate_to) return;
    navigate(`${navPrefix}${navigate_to}`);
  };

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
          <Swiper
            key={rowIndex}
            className="movie_card_swiper"
            style={{ marginTop: rowIndex === 0 ? "24px" : "12px" }}
            spaceBetween={20}
            slidesPerView="auto"
          >
            {rowItems.map((item, index) => (
              <SwiperSlide
                key={
                  item.id || item.filmId || item.link || `${rowIndex}-${index}`
                }
              >
                <CardComponent
                  {...cardProps}
                  {...(CardComponent?.name === "CollectionCard"
                    ? { collection: item }
                    : { movie: item })}
                />
              </SwiperSlide>
            ))}
          </Swiper>
        ))}
      </div>
    </div>
  );
}

export default ContentRowSwiper;
