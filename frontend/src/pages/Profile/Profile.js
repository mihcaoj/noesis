import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import axiosInstance from "../../services/api";
import Navbar from "../../components/Layout/NavBar/NavBar";
import ReviewForm from "../../components/Forms/Review/Review";
import SetAvailability from "../../components/Forms/Availability/SetAvailability";
import Booking from "../../components/Forms/Booking/Booking";
import EditProfile from "../../components/Forms/EditProfile/EditProfile";
import ToastNotifications from "../../components/Common/ToastNotifications/ToastNotifications";
import { useToast } from "../../utils/hooks";
import { getFallbackAvatar } from "../../utils/avatar";
import { formatDate, formatTime } from "../../utils/dateTimeUtils";
import {
  groupAvailabilitiesByWeek,
  getWeekday,
  filterCurrentAndFutureAvailabilities,
} from "../../utils/availabilityUtils";
import "../../components/Common/Buttons/Buttons.css";
import "./Profile.css";

/**
 * Profile Page
 *
 * Displays user profiles with the following features:
 * - Displaying tutor topics, rates, and reviews
 * - Viewing and editing profile information
 * - Managing availability (for tutors)
 * - Booking sessions form (for students)
 * - Messaging option (for students)
 */
const Profile = () => {
  const MAX_BIO_LENGTH = 500;
  const MAX_LESSON_DESCRIPTION_LENGTH = 1000;

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loggedInUsername, setLoggedInUsername] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [showSetAvailability, setShowSetAvailability] = useState(false);
  const [availabilities, setAvailabilities] = useState([]);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [hasCompletedSessions, setHasCompletedSessions] = useState(false);
  const { toastMessage, toastType, showToast, clearToast } = useToast();
  const navigate = useNavigate();
  const { username } = useParams();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const openReview = queryParams.get("openReview") === "true";
  const [completedSessionId, setCompletedSessionId] = useState(null);
  const [expandedReviews, setExpandedReviews] = useState({});

  // Filter availabilities to only show current and future ones
  const currentAndFutureAvailabilities = useMemo(
    () => filterCurrentAndFutureAvailabilities(availabilities),
    [availabilities],
  );

  // Group the filtered availabilities for display
  const groupedAvailabilities = useMemo(
    () => groupAvailabilitiesByWeek(currentAndFutureAvailabilities, true),
    [currentAndFutureAvailabilities],
  );

  // Handles navigation to messaging interface with auth check, redirects to login if user not authenticated
  const handleMessageClick = () => {
    const accessToken = localStorage.getItem("access_token");
    if (accessToken) {
      navigate(`/messages?receiver=${profile.id}`);
    } else {
      showToast("Please log in to send messages", "error");
      setTimeout(() => navigate("/register"), 2000);
    }
  };

  const handleEditToggle = () => {
    setIsEditing((prev) => !prev);
  };

  // Toggles expanded/collapsed state for a review
  const toggleReviewExpansion = (reviewId) => {
    setExpandedReviews((prev) => ({
      ...prev,
      [reviewId]: !prev[reviewId],
    }));
  };

  useEffect(() => {
    // Fetches tutor topics if profile has Tutor role
    const fetchTutorTopics = async () => {
      try {
        const response = await axiosInstance.get(
          `/users/${profile.id}/topics/`,
        );

        // If response.data is not an array
        const topics = Array.isArray(response.data)
          ? response.data
          : response.data.topics || [];

        setProfile((prev) => ({ ...prev, topics }));
      } catch (error) {
        console.error("Error fetching tutor topics:", error.response?.data);

        // This allows the profile to still display without topics
        setProfile((prev) => ({
          ...prev,
          topics: prev.topics || [],
        }));
      }
    };

    if (profile && profile.roles && profile.roles.includes("Tutor")) {
      fetchTutorTopics();
    }
    // eslint-disable-next-line
  }, [profile?.id, profile?.roles]);

  useEffect(() => {
    const fetchProfileAndReviews = async (currentUser) => {
      try {
        const profileResponse = await axiosInstance.get(
          `/profile/${username}/`,
        );
        setProfile(profileResponse.data);

        // Only fetch reviews if valid profile ID
        if (profileResponse.data && profileResponse.data.id) {
          try {
            const reviewsResponse = await axiosInstance.get(
              `/reviews/${profileResponse.data.id}/`,
            );
            setReviews(reviewsResponse.data);
          } catch (error) {
            console.error("Error fetching reviews:", error);
            // Set empty reviews array
            setReviews([]);
          }
        } else {
          setReviews([]);
        }

        if (localStorage.getItem("access_token") && currentUser) {
          try {
            // Fetch all completed sessions with this tutor
            const sessionsResponse = await axiosInstance.get(
              `/sessions/?tutor=${profileResponse.data.id}&status=completed`,
            );

            const completedSessions = sessionsResponse.data.results.filter(
              (session) =>
                session.status === "completed" &&
                session.student_name === currentUser,
            );

            // If completed sessions, check if any of them are reviewable
            if (completedSessions.length > 0) {
              const firstSessionId = completedSessions[0].id;
              setCompletedSessionId(firstSessionId);

              // Check if this session already has a review
              try {
                const reviewCheckResponse = await axiosInstance.get(
                  `/reviews/check/${firstSessionId}/`,
                );

                // Only allow review if there isn't already one
                setHasCompletedSessions(!reviewCheckResponse.data.exists);
              } catch (error) {
                console.error("Error checking review status:", error);
                setHasCompletedSessions(true);
              }
            } else {
              setHasCompletedSessions(false);
            }
          } catch (error) {
            console.error("Error fetching sessions:", error);
            setHasCompletedSessions(false);
          }
        } else {
          setHasCompletedSessions(false);
        }

        // Fetch tutor availabilities
        if (
          profileResponse.data &&
          profileResponse.data.roles &&
          Array.isArray(profileResponse.data.roles) &&
          profileResponse.data.roles.includes("Tutor")
        ) {
          try {
            const availabilitiesResponse = await axiosInstance.get(
              `/set-availability/?tutor=${profileResponse.data.id}`,
            );
            setAvailabilities(availabilitiesResponse.data);
          } catch (error) {
            console.error("Error fetching availabilities:", error);
          }
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
        showToast("Failed to load profile information", "error");
      } finally {
        setLoading(false);
      }
    };

    const initializeData = async () => {
      setLoading(true);

      try {
        // Check if user is authenticated
        if (localStorage.getItem("access_token")) {
          try {
            const response = await axiosInstance.get(`/profile/`);
            setLoggedInUsername(response.data.username);
            fetchProfileAndReviews(response.data.username);
          } catch (error) {
            console.error("Error getting current user:", error);
            // If token is invalid or expired, clear it
            if (
              error.response &&
              (error.response.status === 401 || error.response.status === 403)
            ) {
              localStorage.removeItem("access_token");
            }
            // Continue as unauthenticated user
            setLoggedInUsername(null);
            fetchProfileAndReviews(null);
          }
        } else {
          setLoggedInUsername(null);
          fetchProfileAndReviews(null);
        }
      } catch (error) {
        console.error("Error initializing data:", error);
        showToast("Failed to load user information", "error");
        setLoading(false);
      }
    };

    initializeData();
  }, [username, showToast]);

  useEffect(() => {
    const handleProfilePictureRemoved = () => {
      setProfile((prev) => ({
        ...prev,
        profile_picture: null,
      }));
    };

    document.addEventListener(
      "profilePictureRemoved",
      handleProfilePictureRemoved,
    );

    return () => {
      document.removeEventListener(
        "profilePictureRemoved",
        handleProfilePictureRemoved,
      );
    };
  }, []);

  useEffect(() => {
    if (openReview && profile && hasCompletedSessions) {
      setShowReviewForm(true);

      // Clean up the URL without reloading the page
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [openReview, profile, hasCompletedSessions]);

  /**
   * Saves new or updated availability slot to state
   *
   * @param {Object} newAvailability - The availability slot to save
   */
  const handleSaveAvailability = (newAvailability) => {
    setAvailabilities((prev) => {
      const index = prev.findIndex((a) => a.id === newAvailability.id);
      if (index !== -1) {
        prev[index] = newAvailability;
        return [...prev];
      }
      return [...prev, newAvailability];
    });
    showToast("Availability updated successfully", "success");
  };

  /**
   * Deletes an  availability slot from backend and updates state
   *
   * @param {string} availabilityId - ID of the slot to delete
   * @throws Shows error toast if deletion fails
   */
  const handleDeleteAvailability = async (availabilityId) => {
    try {
      await axiosInstance.delete(`/set-availability/${availabilityId}/`);
      setAvailabilities((prev) =>
        prev.filter((availability) => availability.id !== availabilityId),
      );
      showToast("Availability slot removed", "success");
    } catch (error) {
      showToast("Failed to delete availability slot", "error");
    }
  };

  /**
   * Refreshes profile data after updates and exits edit mode
   *
   * @param {Object} updatedProfile - The new profile data
   */
  const handleProfileUpdated = (updatedProfile) => {
    const fetchUpdatedProfile = async () => {
      try {
        const response = await axiosInstance.get(`/profile/${username}/`);
        setProfile(response.data);
      } catch (error) {
        console.error("Error refreshing profile:", error);
      }
    };

    fetchUpdatedProfile();
    setIsEditing(false);
  };

  if (loading) {
    return (
      <div className="profile-page page-container">
        <Navbar hideLinks={true} />
        <div className="profile-header">
          <div className="profile-image-container">
            <img src={getFallbackAvatar("Loading")} alt="Loading profile" />
            <h2>Loading profile...</h2>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="profile-page page-container">
        <Navbar hideLinks={true} />
        <div className="profile-header">
          <div className="profile-image-container">
            <img src={getFallbackAvatar("Not Found")} alt="Profile not found" />
            <h2>Profile not found</h2>
          </div>
        </div>
      </div>
    );
  }

  const currentRoles = Array.isArray(profile.roles)
    ? profile.roles
        .map((role) => (typeof role === "string" ? role : role.name))
        .filter(Boolean)
    : [];

  return (
    <div className="profile-page page-container">
      <Navbar hideLinks={true} />

      {toastMessage && (
        <ToastNotifications
          message={toastMessage}
          type={toastType}
          onClose={clearToast}
        />
      )}

      <div className="profile-header">
        <div className="profile-image-container">
          <img
            src={
              profile.profile_picture
                ? profile.profile_picture.startsWith("http")
                  ? profile.profile_picture
                  : `${process.env.REACT_APP_API_URL}${profile.profile_picture}`
                : getFallbackAvatar(profile.username)
            }
            onError={(e) => {
              e.target.onerror = null; // Prevent infinite loop if fallback also fails
              e.target.src = getFallbackAvatar(profile.username);
            }}
            alt={`${profile.username}`}
          />
          <h2>{profile.username}</h2>

          {currentRoles.includes("Tutor") && (
            <>
              {profile.hourly_rate && (
                <p>
                  <strong>Hourly Rate:</strong> {profile.hourly_rate} CHF
                </p>
              )}
              <p>
                <strong>Topic(s):</strong>{" "}
                {profile.topics && profile.topics.length > 0
                  ? profile.topics.join(", ")
                  : "No topics specified."}
              </p>
              <p>
                <strong>Preferred Mode:</strong>{" "}
                {profile.preferred_mode
                  ? profile.preferred_mode === "in-person"
                    ? "In-Person"
                    : profile.preferred_mode === "both" ||
                        profile.preferred_mode === "Both"
                      ? "In-person, Webcam"
                      : profile.preferred_mode.charAt(0).toUpperCase() +
                        profile.preferred_mode.slice(1)
                  : "In-person, Webcam"}
              </p>
              {profile.average_rating && profile.total_ratings > 0 && (
                <p>
                  <strong>Rating:</strong> {profile.average_rating} (
                  {profile.total_ratings}{" "}
                  {profile.total_ratings === 1 ? "rating" : "ratings"})
                </p>
              )}
            </>
          )}
          <p>
            <strong>Role(s):</strong>{" "}
            {currentRoles.length > 0
              ? currentRoles.join(", ")
              : "No roles assigned."}
          </p>

          {loggedInUsername === profile.username ? (
            !isEditing &&
            !showSetAvailability && (
              <>
                <button
                  className="button button--primary"
                  onClick={handleEditToggle}
                  aria-label="Edit Profile"
                >
                  Edit Profile
                </button>
                {currentRoles.includes("Tutor") && (
                  <button
                    className="button button--primary"
                    onClick={() => setShowSetAvailability(true)}
                  >
                    Set Availability
                  </button>
                )}
              </>
            )
          ) : (
            <>
              {!isEditing &&
                !showReviewForm &&
                !showBookingModal &&
                currentRoles.includes("Tutor") && (
                  <>
                    {localStorage.getItem("access_token") ? (
                      // Show all interactive buttons for authenticated users
                      <>
                        <button
                          className="button button--primary"
                          onClick={handleMessageClick}
                        >
                          Message
                        </button>
                        {hasCompletedSessions && (
                          <button
                            className="button button--primary"
                            onClick={() => setShowReviewForm(true)}
                          >
                            Rate & Review
                          </button>
                        )}
                        <button
                          className="button button--primary"
                          onClick={() => setShowBookingModal(true)}
                        >
                          Book Session
                        </button>
                      </>
                    ) : (
                      // Show a login prompt button for unauthenticated users
                      <button
                        className="button button--primary"
                        // Force redirect with window.location for direct browser navigation instead of React Router's navigate to bypass a problem I encoutered
                        onClick={() =>
                          (window.location.href = `/login?redirect=${encodeURIComponent(`/profile/${username}`)}`)
                        }
                      >
                        Login to interact
                      </button>
                    )}
                  </>
                )}
            </>
          )}
        </div>
      </div>

      {isEditing ? (
        <EditProfile
          profile={profile}
          onSaveChanges={handleProfileUpdated}
          onCancelEdit={handleEditToggle}
          onToast={(message, type) => {
            showToast(message, type);
          }}
          MAX_BIO_LENGTH={MAX_BIO_LENGTH}
          MAX_LESSON_DESCRIPTION_LENGTH={MAX_LESSON_DESCRIPTION_LENGTH}
        />
      ) : (
        <>
          {showReviewForm && (
            <ReviewForm
              sessionId={completedSessionId}
              tutorName={profile.username}
              onClose={() => setShowReviewForm(false)}
            />
          )}
          {showSetAvailability && loggedInUsername === profile.username && (
            <SetAvailability
              availabilities={availabilities}
              onSave={handleSaveAvailability}
              onDelete={handleDeleteAvailability}
              onCancel={() => setShowSetAvailability(false)}
            />
          )}
          {showBookingModal && (
            <Booking
              tutorId={profile.id}
              availabilities={availabilities}
              onClose={() => setShowBookingModal(false)}
            />
          )}

          <div className="profile-section">
            <h3>About</h3>
            <p>{profile.bio || "No bio available."}</p>
          </div>

          {currentRoles.includes("Tutor") && (
            <div className="profile-section">
              <h3>Lesson Description</h3>
              <p>
                {profile.lesson_description ||
                  "No lesson description provided."}
              </p>
            </div>
          )}
        </>
      )}

      {currentRoles.includes("Tutor") && (
        <div className="profile-section">
          <h3>Availability</h3>
          {currentAndFutureAvailabilities.length > 0 ? (
            <div className="availability-sections">
              {/* Recurring Availabilities Section */}
              {groupedAvailabilities.recurring.length > 0 && (
                <div className="availability-section">
                  <h4 className="availability-week-header">Recurring</h4>
                  <div className="availability-grid">
                    {groupedAvailabilities.recurring.map((slot) => (
                      <div
                        key={slot.id}
                        className="availability-card recurring"
                      >
                        <div className="availability-date">
                          {getWeekday(slot.available_date, true)}
                        </div>
                        <div className="availability-time">
                          <span className="time-badge">
                            {formatTime(slot.available_time_start)}
                            {" - "}
                            {formatTime(slot.available_time_end)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* One-time Availabilities by Week */}
              {groupedAvailabilities.weeks.map((week, index) => (
                <div key={index} className="availability-section">
                  <h4 className="availability-week-header">{week.weekRange}</h4>
                  <div className="availability-grid">
                    {week.slots.map((slot) => (
                      <div key={slot.id} className="availability-card">
                        <div className="availability-date">
                          {formatDate(slot.available_date)}
                        </div>
                        <div className="availability-time">
                          <span className="time-badge">
                            {formatTime(slot.available_time_start)}
                            {" - "}
                            {formatTime(slot.available_time_end)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>No availabilities set.</p>
          )}
        </div>
      )}

      {currentRoles.includes("Tutor") && (
        <div className="profile-section">
          <h3>Reviews</h3>
          {reviews.length > 0 ? (
            <div className="reviews-section">
              <div className="reviews-grid">
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    className={`review-card ${expandedReviews[review.id] ? "expanded" : ""}`}
                  >
                    <div className="review-header">
                      <span className="reviewer-name">
                        {review.student_name}
                      </span>
                      <span className="review-rating">★ {review.rating}</span>
                    </div>
                    {review.comment && (
                      <span className="review-badge">
                        <div className="review-comment">{review.comment}</div>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="no-reviews">No reviews yet.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default Profile;
