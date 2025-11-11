import React from "react";
import "../../styles/MediaCard.css";
import config from "../../core/config";
import { useNavigate } from "react-router-dom";

function CollectionCardInner(props) {
  const navigate = useNavigate();

  const collection = props.movie || props.collection || props.item || props;
  if (!collection) return null;

  const { navigate_to, local_url, title, filename } = collection;

  const handleClick = (e) => {
    e.stopPropagation();
    if (navigate_to) {
      navigate(`/category/${navigate_to}`);
    }
  };

  let imgSrc;
  if (local_url) {
    imgSrc = local_url.startsWith("http")
      ? local_url
      : `${config.backend_url}${local_url}`;
  }

  return (
    <div className="video-card-container" onClick={handleClick}>
      <div className="video-card-preview-wrapper-explorer">
        {imgSrc && (
          <img
            src={imgSrc}
            alt={title || filename || "collection"}
            className="video-card_preview-image"
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
