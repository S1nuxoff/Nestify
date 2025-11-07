import React, { useState, useRef, useEffect } from "react";
import { ReactComponent as SearchIcon } from "../../assets/icons/search.svg";
import { useNavigate } from "react-router-dom";
import "../../styles/Header.css";
import config from "../../core/config";

function SearchInput({ onMovieSelect }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);
  const debounceTimeoutRef = useRef(null);
  const navigate = useNavigate(); // ⬅️ роутер

  /* автодополнение */
  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = setTimeout(() => {
      fetch(
        `${
          config.backend_url
        }/api/v1/rezka/get_search?title=${encodeURIComponent(query)}`
      )
        .then((r) => r.json())
        .then((d) => setSuggestions(d.results || []))
        .catch(() => setSuggestions([]));
    }, 500);
    return () => clearTimeout(debounceTimeoutRef.current);
  }, [query]);

  /* отправка формы → переход на /search */
  const handleSubmit = (e) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    navigate(`/search?query=${encodeURIComponent(q)}`); // ⬅️ переход
    setSuggestions([]);
    inputRef.current?.blur();
  };

  return (
    <div className="search-container">
      <form className="hdrezka-header-input-container" onSubmit={handleSubmit}>
        <SearchIcon className="search-icon" />
        <input
          ref={inputRef}
          type="search"
          className="hdrezka-header-search-input"
          placeholder="Шукайте фільми, серіали..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
        />
      </form>

      {isFocused && suggestions.length > 0 && (
        <ul className="search-suggestions">
          {suggestions.map((item, idx) => (
            <li key={idx} onClick={() => onMovieSelect(item)}>
              <strong className="search-title">{item.title}</strong>
              <div className="search-description">{item.description}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default SearchInput;
