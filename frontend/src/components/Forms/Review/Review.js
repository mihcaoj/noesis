import React, { useState, useEffect } from "react";
import axiosInstance from "../../../services/api";
import ToastNotifications from "../../Common/ToastNotifications/ToastNotifications";
import { useToast } from "../../../utils/hooks";
import "../../Common/Buttons/Buttons.css";
import "./Review.css";

/**
 * Review Form
 *
 * Enables students to provide feedback on sessions with the following features:
 * - 5-star rating system
 * - Optional review field for feedback
 * - Prevention of duplicate reviews for the same session
 * - Viewing previously submitted reviews on tutor profile
 */
const ReviewForm = ({ sessionId, tutorName, onClose }) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const { toastMessage, toastType, showToast, clearToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [existingReview, setExistingReview] = useState(null);

  useEffect(() => {
    const checkExistingReview = async () => {
      try {
        setLoading(true);
        // Fetch reviews for the tutor to check if this session already has a review
        const response = await axiosInstance.get(
          `/reviews/check/${sessionId}/`,
        );

        if (response.data && response.data.exists) {
          setExistingReview(response.data.review);
          showToast("You have already reviewed this session", "error");
        }
      } catch (error) {
        console.error("Error checking existing review:", error);
      } finally {
        setLoading(false);
      }
    };

    if (sessionId) {
      checkExistingReview();
    }
  }, [sessionId, showToast]);

  /**
   * Handles review form submission
   *
   * @param {Object} e - Event object from form submission
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    clearToast();

    try {
      const response = await axiosInstance.post("/submit-review/", {
        session_id: sessionId,
        rating,
        comment,
      });
      const responseMessage = response.data.message;
      showToast(responseMessage, "success");
      setTimeout(onClose, 300);
    } catch (err) {
      const errorMessage =
        err.response?.data?.detail || "Error submitting review";
      showToast(errorMessage, "error");
    }
  };

  // Resets form fields and closes the review form
  const handleCancel = () => {
    setRating(0);
    setComment("");
    clearToast();
    onClose();
  };

  if (loading) {
    return (
      <div className="popout-form review-form">
        <h3>Checking review status...</h3>
      </div>
    );
  }

  if (existingReview) {
    return (
      <div className="popout-form review-form">
        <h3>You've already reviewed this session</h3>
        <div className="review-form-container">
          <p>
            You've already provided a {existingReview.rating}-star review for
            this session.
          </p>
          {existingReview.comment && (
            <p>Your comment: "{existingReview.comment}"</p>
          )}
          <div className="button-container">
            <button
              type="button"
              className="button button--close"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
        {toastMessage && (
          <ToastNotifications
            message={toastMessage}
            type={toastType}
            onClose={clearToast}
          />
        )}
      </div>
    );
  }

  return (
    <div className="popout-form review-form">
      <h3>Rate and Review {tutorName}</h3>

      {toastMessage && (
        <ToastNotifications
          message={toastMessage}
          type={toastType}
          onClose={clearToast}
        />
      )}

      <div className="review-form-container">
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label>Rating:</label>
            <select
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              required
            >
              <option value="">Select a Rating</option>
              {[1, 2, 3, 4, 5].map((star) => (
                <option key={star} value={star}>
                  {star} Star{star > 1 && "s"}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Comment (Optional):</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your experience with this tutor..."
            />
          </div>

          <div className="button-container">
            <button type="submit" className="button button--primary">
              Save Review
            </button>
            <button
              type="button"
              className="button button--close"
              onClick={handleCancel}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReviewForm;
