// src/components/ui/SearchButton.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import "../../styles/Header.css";

function SearchButton() {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      className="header-search-btn"
      aria-label="Search"
      onClick={() => navigate("/search")}
    >
      <Search className="header-search-icon" />
    </button>
  );
}

export default SearchButton;
