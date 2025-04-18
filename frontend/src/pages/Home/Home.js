import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../services/api";
import SearchBar from "../../components/Modules/SearchBar/SearchBar";
import TutorCard from "../../components/Modules/TutorCard/TutorCard";
import Navbar from "../../components/Layout/NavBar/NavBar";
import { POPULAR_TOPICS } from "../../utils/topics";
import "./Home.css";

/**
 * Home Page
 *
 * Homepage of the application with the following features:
 * - Browsing topics and tutors via the searchbar
 * - Searching and filtering available tutors
 * - Viewing tutor cards with relevant tutor information
 * - Navigating to tutor profiles by clicking on tutor card
 */
const Home = () => {
  const [tutors, setTutors] = useState([]);
  const [filteredTutors, setFilteredTutors] = useState([]);
  const [activeFilter, setActiveFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const fetchTutors = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const timestamp = new Date().getTime();
      let allTutors = [];

      // Paginated tutors endpoint
      try {
        const firstPageResponse = await axiosInstance.get(
          `/tutors/?t=${timestamp}`,
        );

        // Process first page response
        if (Array.isArray(firstPageResponse.data)) {
          allTutors = firstPageResponse.data;
        } else if (
          firstPageResponse.data.results &&
          Array.isArray(firstPageResponse.data.results)
        ) {
          allTutors = firstPageResponse.data.results;

          // Fetch additional pages if necessary
          let nextPage = firstPageResponse.data.next;
          while (nextPage) {
            const nextPageUrl = new URL(nextPage);
            const pageParams = nextPageUrl.search;
            const nextPageResponse = await axiosInstance.get(
              `/tutors/${pageParams}`,
            );

            if (
              nextPageResponse.data.results &&
              Array.isArray(nextPageResponse.data.results)
            ) {
              allTutors = [...allTutors, ...nextPageResponse.data.results];
              nextPage = nextPageResponse.data.next;
            } else {
              nextPage = null;
            }
          }
        }
      } catch (mainError) {
        console.warn("Error with main tutors fetch approach:", mainError);
      }

      if (allTutors.length > 0) {
        try {
          // For each tutor, get the full profile data
          const tutorDetailsPromises = allTutors.map(async (tutor) => {
            try {
              const profileResponse = await axiosInstance.get(
                `/profile/${tutor.username}/`,
              );

              // Update the tutor with profile data, including ratings
              return {
                ...tutor,
                average_rating: profileResponse.data.average_rating,
                total_ratings: profileResponse.data.total_ratings,
              };
            } catch (error) {
              console.error(
                `Error fetching profile for ${tutor.username}:`,
                error,
              );
              return tutor;
            }
          });

          // Wait for all profile fetches to complete
          const enhancedTutors = await Promise.all(tutorDetailsPromises);
          allTutors = enhancedTutors;
        } catch (error) {
          console.error("Error enhancing tutors with profile data:", error);
        }
      }

      const processedTutors = allTutors.map((tutor) => ({
        ...tutor,
        topics: tutor.topics || [],
        // Ensure average rating is a number or null
        average_rating: tutor.average_rating
          ? parseFloat(tutor.average_rating)
          : null,
        // Ensure total_ratings is a number
        total_ratings: tutor.total_ratings
          ? parseInt(tutor.total_ratings, 10)
          : 0,
      }));

      // Load all reviews before setting state
      if (processedTutors.length > 0) {
        try {
          const tutorsWithReviews = await loadAllReviews(processedTutors);
          setTutors(tutorsWithReviews);
          setFilteredTutors(sortTutors(tutorsWithReviews));
        } catch (error) {
          console.error("Error completing tutor data:", error);
          setTutors(processedTutors);
          setFilteredTutors(processedTutors);
        }
      } else {
        setTutors([]);
        setFilteredTutors([]);
      }
    } catch (error) {
      console.error("Failed to fetch tutors:", error);
      setError(error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAllReviews = async (tutors) => {
    const tutorsWithRatings = [...tutors];

    try {
      // Create an array of promises to fetch all reviews in parallel
      const reviewPromises = tutors.map(async (tutor) => {
        try {
          const response = await axiosInstance.get(`/reviews/${tutor.id}/`);
          const reviews = response.data;

          if (reviews && reviews.length > 0) {
            // Calculate average rating
            const totalRating = reviews.reduce(
              (sum, review) => sum + review.rating,
              0,
            );
            const averageRating = totalRating / reviews.length;

            // Return the tutor id and rating data
            return {
              id: tutor.id,
              average_rating: averageRating,
              total_ratings: reviews.length,
            };
          }
          return { id: tutor.id, average_rating: null, total_ratings: 0 };
        } catch (error) {
          console.error(`Error loading reviews for ${tutor.username}:`, error);
          return { id: tutor.id, average_rating: null, total_ratings: 0 };
        }
      });

      // Wait for all review requests to complete
      const reviewResults = await Promise.all(reviewPromises);

      // Update tutors with their rating data
      reviewResults.forEach((result) => {
        const tutorIndex = tutorsWithRatings.findIndex(
          (t) => t.id === result.id,
        );
        if (tutorIndex >= 0) {
          tutorsWithRatings[tutorIndex] = {
            ...tutorsWithRatings[tutorIndex],
            average_rating: result.average_rating,
            total_ratings: result.total_ratings,
          };
        }
      });

      return tutorsWithRatings;
    } catch (error) {
      console.error("Error loading review data:", error);
      return tutors;
    }
  };

  /**
   * Sorts tutors by weighted rating and hourly rate with the following priority:
   * - Tutors with ratings appear before those without
   * - Rated tutors are sorted by weighted score (rating * rating count bonus)
   * - Ratings are weighted to favor tutors with more reviews (capped at 10)
   * - If ratings are equal, sorts by hourly rate (cheaper first)
   *
   * @param {Array} tutors - Array of tutor objects to sort
   * @returns {Array} New sorted array of tutors (original array not modified)
   */
  const sortTutors = (tutors) => {
    return [...tutors].sort((a, b) => {
      const aRating = parseFloat(a.average_rating) || 0;
      const bRating = parseFloat(b.average_rating) || 0;
      const aCount = parseInt(a.total_ratings) || 0;
      const bCount = parseInt(b.total_ratings) || 0;

      // Does one tutor have ratings and the other does not?
      const aHasRating = aRating > 0 && aCount > 0;
      const bHasRating = bRating > 0 && bCount > 0;

      if (aHasRating && !bHasRating) {
        return -1;
      }
      if (!aHasRating && bHasRating) {
        return 1;
      }

      // If both have ratings, compare the weighted scores
      if (aHasRating && bHasRating) {
        const aScore = aRating * (1 + Math.min(aCount, 10) / 10);
        const bScore = bRating * (1 + Math.min(bCount, 10) / 10);

        // Highest score first
        if (aScore !== bScore) {
          return bScore - aScore;
        }
      }

      // Compare by price
      const aPrice = parseFloat(a.hourly_rate) || Number.MAX_VALUE;
      const bPrice = parseFloat(b.hourly_rate) || Number.MAX_VALUE;

      // Lower hourly rate first
      return aPrice - bPrice;
    });
  };

  useEffect(() => {
    const initializeData = async () => {
      await fetchTutors();
    };

    initializeData();
  }, [fetchTutors]);

  useEffect(() => {
    if (tutors.length > 0) {
      let tutorsToShow = [...tutors];

      if (activeFilter) {
        const queryLower = activeFilter.toLowerCase();
        tutorsToShow = tutorsToShow.filter((tutor) => {
          return (
            (tutor.bio && tutor.bio.toLowerCase().includes(queryLower)) ||
            (tutor.username &&
              tutor.username.toLowerCase().includes(queryLower)) ||
            (tutor.first_name &&
              tutor.first_name.toLowerCase().includes(queryLower)) ||
            (tutor.last_name &&
              tutor.last_name.toLowerCase().includes(queryLower)) ||
            (tutor.lesson_description &&
              tutor.lesson_description.toLowerCase().includes(queryLower)) ||
            (tutor.topics &&
              Array.isArray(tutor.topics) &&
              tutor.topics.some(
                (topic) =>
                  typeof topic === "string" &&
                  topic.toLowerCase().includes(queryLower),
              ))
          );
        });
      }

      // Sort and validate result
      const sortedTutors = sortTutors(tutorsToShow);
      setFilteredTutors(sortedTutors);
    }
  }, [tutors, activeFilter]);

  const handleSearch = (query) => {
    if (!query.trim()) {
      setFilteredTutors(sortTutors(tutors));
      setActiveFilter("");
      return;
    }

    setActiveFilter(query);
  };

  const handleTopicClick = (topic) => {
    handleSearch(topic);
  };

  const handleClearFilter = () => {
    setFilteredTutors(tutors);
    setActiveFilter("");
  };

  const handleTutorCardClick = (username) => {
    setTimeout(() => {
      navigate(`/profile/${username}`);
    }, 50);
  };

  if (loading) {
    return (
      <div className="page-container-flex">
        <Navbar />
        <div className="loading-container">
          <p>Loading tutors...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container-flex">
        <Navbar />
        <div className="error-container">
          <p>Error loading tutors</p>
          <p>{error.message}</p>
          <button className="button button--primary" onClick={fetchTutors}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container-flex homepage">
      <Navbar />

      <header className="page-header homepage-header">
        <div className="logo-container">
          <img
            src="/logo192.svg"
            alt="App Logo"
            style={{
              filter:
                "invert(17%) sepia(5%) saturate(1186%) hue-rotate(329deg) brightness(93%) contrast(85%)",
            }}
          />
        </div>
        <h1>Find a tutor</h1>
        <div className="search-bar-container">
          <SearchBar onSearch={handleSearch} placeholder="Type any topic..." />
        </div>
      </header>

      <section className="topics-container">
        {POPULAR_TOPICS.map((topic, index) => (
          <div
            key={index}
            className="topic-card"
            onClick={() => handleTopicClick(topic)}
          >
            <span>{topic}</span>
          </div>
        ))}
      </section>

      {activeFilter && (
        <div className="active-filter-container">
          <div className="active-filter">
            <span>
              <strong>Filter:</strong> {activeFilter}
            </span>
            <button className="remove-filter-btn" onClick={handleClearFilter}>
              ×
            </button>
          </div>
        </div>
      )}

      <section className="tutor-cards-container">
        {filteredTutors.length > 0 ? (
          filteredTutors.map((tutor) => (
            <div
              key={tutor.id}
              onClick={() => handleTutorCardClick(tutor.username)}
              style={{ cursor: "pointer" }}
            >
              <TutorCard user={tutor} />
            </div>
          ))
        ) : (
          <div className="no-tutors-message">
            <p>No tutors available for this topic.</p>
            <button
              className="button button--secondary"
              onClick={handleClearFilter}
            >
              Clear filter
            </button>
            <button
              className="button button--primary"
              onClick={() => {
                handleClearFilter();
                fetchTutors();
              }}
              style={{ marginLeft: "10px" }}
            >
              Refresh
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

export default Home;
