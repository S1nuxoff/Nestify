import React from "react";
import { useNavigate } from "react-router-dom";
import config from "../../core/config";
import "../../styles/CollectionCard.css";

function CollectionCardInner(props) {
  const navigate = useNavigate();

  const collection = props.movie || props.collection || props.item || props;
  if (!collection) return null;

  const { navigate_to, local_url, title, filename } = collection;

  const handleClick = (e) => {
    e.stopPropagation();
    if (navigate_to) navigate(`/category/${navigate_to}`);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (navigate_to) navigate(`/category/${navigate_to}`);
    }
  };

  let imgSrc = "";
  if (local_url) {
    imgSrc = local_url.startsWith("http")
      ? local_url
      : `${config.backend_url}${local_url}`;
  }

  return (
    <div
      className="collection-card"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={title || filename || "Колекція"}
    >
      <div className="collection-card__preview">
        {imgSrc && (
          <img
            src={imgSrc}
            alt={title || filename || "collection"}
            className="collection-card__img"
            loading="lazy"
            decoding="async"
          />
        )}
      </div>
    </div>
  );
}

const CollectionCard = React.memo(CollectionCardInner);
export default CollectionCard;
