// src/components/ui/CategorySelector.jsx
import React from "react";
import "../../styles/CategorySelector.css";

function CategorySelector({ categories, active, onChange }) {
  return (
    <div className="home-category-selector">
      {categories.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          className={`home-cat-btn${active === key ? " home-cat-btn--active" : ""}`}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default CategorySelector;
