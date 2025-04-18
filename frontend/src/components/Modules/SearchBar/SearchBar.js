import React, { useState } from "react";
import "./SearchBar.css";

/**
 * Search Bar Component
 *
 * Provides search functionality with the following feature:
 * - Real-time filtering as the user types (topic, tutor names, keywords)
 */
const SearchBar = ({ onSearch }) => {
  const [query, setQuery] = useState("");

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    if (onSearch) {
      onSearch(value);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      onSearch(query);
    }
  };

  return (
    <div className="search-bar-container">
      <div className="search-bar">
        <svg
          className="search-icon"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          type="text"
          className="search-input"
          placeholder="Search by topic, name or keywords..."
          value={query}
          onChange={handleInputChange}
          onKeyUp={handleKeyPress}
        />
      </div>
    </div>
  );
};

export default SearchBar;
