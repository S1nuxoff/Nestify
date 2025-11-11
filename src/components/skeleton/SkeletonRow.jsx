import React from "react";
import "../../styles/Skeleton.css";
import SkeletonCard from "./SkeletonCard";

export default function SkeletonRow({ cards = 8, titleWidth = 240 }) {
  return (
    <div className="skel-row">
      <div
        className="skeleton skeleton-text lg row-title"
        style={{ width: titleWidth }}
      />
      <div className="row-track">
        {Array.from({ length: cards }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
