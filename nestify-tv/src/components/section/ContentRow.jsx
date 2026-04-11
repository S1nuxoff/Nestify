// src/components/section/ContentRow.jsx
// Native horizontal scroll row — no Swiper, smooth on mobile
import React from "react";
import "../../styles/ContentRow.css";

const ContentRow = ({ title, data = [], CardComponent, cardProps = {}, autoWidth = false }) => {
  if (!data || data.length === 0) return null;

  return (
    <div className="cr-container">
      {title && <h2 className="cr-title">{title}</h2>}
      <div className="cr-scroll">
        {data.map((item, index) => {
          const key = item.id || item.filmId || item.link || index;
          const cardSpecificProps =
            CardComponent?.name === "CollectionCard"
              ? { collection: item }
              : { movie: item };

          return (
            <div className={autoWidth ? "cr-item-auto" : "cr-item"} key={key}>
              <CardComponent {...cardProps} {...cardSpecificProps} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default React.memo(ContentRow);
