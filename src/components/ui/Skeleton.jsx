// src/components/Skeleton.js

import React from "react";
import "../../styles/Skeleton.css";

/**
 * Простой прямоугольный скелетон
 * @param {string} width  — ширина, по умолчанию 100%
 * @param {string} height — высота, по умолчанию 16px
 */
export const SkeletonLine = ({ width = "100%", height = "16px" }) => {
  return <div className="skeleton skeleton-line" style={{ width, height }} />;
};

/**
 * Скелетон размером с постер (например, 380px высота)
 */
export const SkeletonPoster = () => {
  return <div className="skeleton skeleton-poster" />;
};
