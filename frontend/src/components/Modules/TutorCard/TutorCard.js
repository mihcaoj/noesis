import React, { useState, useEffect } from "react";
import { getFallbackAvatar } from "../../../utils/avatar";
import axiosInstance from "../../../services/api";
import "./TutorCard.css";

/**
 * Tutor Card Component
 *
 * Displays tutor information in a card format with the following features:
 * - Profile picture (with fallback avatar if none)
 * - Display of tutor name, rating, and hourly rate
 * - Topic badges showing teaching subjects
 * - Lesson description preview
 */
const TutorCard = ({ user }) => {
  const [reviewData, setReviewData] = useState(null);
  const [loading, setLoading] = useState(false);

  /**
   * Formats profile picture URL to ensure proper absolute path
   *
   * @param {string} pictureUrl - Original picture URL
   * @returns {string} Properly formatted URL or null
   */
  const getProfilePictureUrl = (pictureUrl) => {
    if (!pictureUrl) return null;

    // If it's already an absolute URL (starts with http), return it
    if (pictureUrl.startsWith("http")) {
      return pictureUrl;
    }

    // Fix for the specific case where the URL includes '/api/media/'
    if (pictureUrl.includes("/api/media/")) {
      const mediaPath = pictureUrl.split("/api/media/")[1];
      const apiBaseUrl = (
        process.env.REACT_APP_API_URL || "http://localhost:8000"
      ).replace(/\/api$/, "");
      return `${apiBaseUrl}/media/${mediaPath}`;
    }

    // If it's a relative path, prepend the API URL
    const apiBaseUrl = (
      process.env.REACT_APP_API_URL || "http://localhost:8000"
    ).replace(/\/api$/, "");

    // Handle different formats of relative paths
    if (pictureUrl.startsWith("/media/")) {
      return `${apiBaseUrl}${pictureUrl}`;
    } else {
      return `${apiBaseUrl}/${pictureUrl.replace(/^\//, "")}`;
    }
  };

  useEffect(() => {
    const fetchReviews = async () => {
      if (hasValidRating(user)) {
        console.log(
          `Using pre-loaded ratings for ${user.username}: ${user.average_rating} (${user.total_ratings} reviews)`,
        );
        return;
      }

      if (user.id) {
        try {
          setLoading(true);
          const response = await axiosInstance.get(`/reviews/${user.id}/`);

          // Calculate average rating from reviews
          if (response.data && response.data.length > 0) {
            const reviews = response.data;
            const totalRating = reviews.reduce(
              (sum, review) => sum + review.rating,
              0,
            );
            const averageRating = totalRating / reviews.length;

            setReviewData({
              average_rating: averageRating,
              total_ratings: reviews.length,
            });
          }
        } catch (error) {
          console.error(`Error fetching reviews for ${user.username}:`, error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchReviews();
  }, [user]);

  // Capitalize first letter of each name part
  const capitalizeWord = (word) => {
    if (!word) return "";
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  };

  // Construct full name, with fallback to username if first/last names are empty
  const fullName =
    user.first_name && user.last_name
      ? `${capitalizeWord(user.first_name)} ${capitalizeWord(user.last_name)}`
      : user.username;

  // Formats lesson description with truncation if needed
  const formatLessonDescription = (description) => {
    if (!description)
      return <span className="empty-description">No Lesson Description</span>;

    // Split the description and truncate to 10 words
    const words = description.split(" ");
    const truncatedDesc = words.slice(0, 10).join(" ");

    return words.length > 12 ? `${truncatedDesc}...` : truncatedDesc;
  };

  const getTopics = (user) => {
    if (!user) return [];

    if (user.topics && Array.isArray(user.topics)) {
      return user.topics;
    }
  };

  // Checks if a rating exists and is valid
  const hasValidRating = (user) => {
    return (
      user.average_rating !== undefined &&
      user.average_rating !== null &&
      user.average_rating > 0
    );
  };

  const profilePictureUrl = getProfilePictureUrl(user.profile_picture);
  const topics = getTopics(user);

  // Determine what rating to display
  const displayRating = hasValidRating(user)
    ? {
        average_rating: user.average_rating,
        total_ratings: user.total_ratings || 0,
      }
    : reviewData;

  return (
    <div className="tutor-card">
      {/* Profile Picture */}
      <img
        src={profilePictureUrl || getFallbackAvatar(user.username)}
        alt={`${fullName}'s profile`}
        onError={(e) => {
          e.target.onerror = null; // Prevent infinite loop
          e.target.src = getFallbackAvatar(user.username);
        }}
      />

      {/* Name */}
      <h3>{fullName}</h3>

      {/* Rating */}
      <div className="tutor-rating">
        {loading ? (
          <span className="loading-ratings">Loading ratings...</span>
        ) : displayRating ? (
          <>
            ★ {parseFloat(displayRating.average_rating).toFixed(1)}
            <span className="rating-count">
              ({displayRating.total_ratings}{" "}
              {displayRating.total_ratings === 1 ? "rating" : "ratings"})
            </span>
          </>
        ) : (
          <span className="no-ratings">No ratings yet</span>
        )}
      </div>

      {/* Hourly Rate */}
      <div className="tutor-hourly-rate">
        {user.hourly_rate ? (
          <p>{user.hourly_rate} CHF/h</p>
        ) : (
          <p className="no-hourly-rate">Hourly rate not specified</p>
        )}
      </div>

      {/* Topics */}
      <div className="tutor-topics">
        {topics.length > 0 ? (
          <div className="topics-list">
            {topics.map((topic, index) => (
              <span key={index} className="topic-badge">
                {topic}
              </span>
            ))}
          </div>
        ) : (
          <p className="no-topics">No topics specified</p>
        )}
      </div>

      {/* Lesson Description */}
      <p>{formatLessonDescription(user.lesson_description)}</p>
    </div>
  );
};

export default TutorCard;
