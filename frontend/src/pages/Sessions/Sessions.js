import React, { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axiosInstance from "../../services/api";
import Navbar from "../../components/Layout/NavBar/NavBar";
import Reschedule from "../../components/Forms/Reschedule/Reschedule";
import ToastNotifications from "../../components/Common/ToastNotifications/ToastNotifications";
import { useToast } from "../../utils/hooks";
import { formatDateTime } from "../../utils/dateTimeUtils";
import {
  isSessionUpcoming,
  isSessionCompleted,
  isPendingSession,
  formatDuration,
  formatSessionMode,
} from "../../utils/sessionUtils";
import "./Sessions.css";

/**
 * Sessions Page
 *
 * Manages sessions with the following features:
 * - Viewing and filtering sessions (all, upcoming, pending, completed)
 * - Accepting or denying session requests (for tutors)
 * - Managing session reschedules and cancellations
 * - Reviewing and rating completed sessions
 */
const Sessions = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [user, setUser] = useState(null);
  const { toastMessage, toastType, showToast, clearToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [reviewedTutorIds, setReviewedTutorIds] = useState([]);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [lastRescheduledTime, setLastRescheduledTime] = useState(null);
  const [sessionToCancel, setSessionToCancel] = useState(null);
  const [rescheduledSessionIds, setRescheduledSessionIds] = useState(() => {
    const saved = localStorage.getItem("rescheduledSessionIds");
    return saved ? JSON.parse(saved) : [];
  });

  const navigateToProfile = (username) => {
    navigate(`/profile/${username}`);
  };

  const hasBeenRescheduled = useCallback(
    (sessionId) => {
      return rescheduledSessionIds.includes(sessionId);
    },
    [rescheduledSessionIds],
  );

  // Fetches all sessions for the current user
  const fetchSessions = useCallback(async () => {
    try {
      const response = await axiosInstance.get("/sessions/");
      setSessions(response.data.results || []);
      setLoading(false);
    } catch (error) {
      showToast("Failed to load sessions. Please try again.", "error");
      setSessions([]);
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    const fetchReviewedTutors = async () => {
      if (user) {
        try {
          const response = await axiosInstance.get("/reviews/reviewed-tutors/");
          setReviewedTutorIds(response.data.tutor_ids || []);
        } catch (error) {
          console.error("Failed to fetch reviewed tutors", error);
        }
      }
    };

    if (user) {
      fetchReviewedTutors();
    }
  }, [user]);

  useEffect(() => {
    // Extract sessionId from URL
    const params = new URLSearchParams(location.search);
    const sessionId = params.get("sessionId");

    if (sessionId) {
      setTimeout(() => {
        const sessionElement = document.querySelector(
          `.session-item[data-session-id='${sessionId}']`,
        );
        if (sessionElement) {
          sessionElement.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
          sessionElement.classList.add("highlight");

          setTimeout(() => {
            sessionElement.classList.remove("highlight");

            // Clean up the URL to avoid the session highlithing again
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
          }, 2000);
        }
      }, 500);
    }
  }, [sessions, location]);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await axiosInstance.get("/profile/");
        setUser(response.data);
      } catch (error) {
        showToast("Failed to load user profile", "error");
      }
    };
    fetchUser();
  }, [showToast]);

  /**
   * Filters and sorts sessions based on current filter state
   *
   * @returns {Array} Filtered and sorted sessions
   */
  const getFilteredSessions = () => {
    let filteredSessions = sessions.filter((session) => {
      switch (filter) {
        case "upcoming":
          return isSessionUpcoming(session);
        case "completed":
          return isSessionCompleted(session);
        case "pending":
          return isPendingSession(session);
        default:
          return true;
      }
    });

    if (filter === "upcoming") {
      // Sort upcoming sessions filter (nearest date first)
      filteredSessions.sort((a, b) => {
        const dateA = new Date(a.date_time);
        const dateB = new Date(b.date_time);

        // Ascending order
        return dateA - dateB;
      });
    } else if (filter === "completed") {
      // Sort completed sessions (newest first)
      filteredSessions.sort((a, b) => {
        const dateA = new Date(a.date_time);
        const dateB = new Date(b.date_time);

        // Descending order
        return dateB - dateA;
      });
    }

    return filteredSessions;
  };

  /**
   * Handles reschedule response for a session
   *
   * @param {string} sessionId - Session ID to respond to
   * @param {string} response - 'accept' or 'reject'
   */
  const handleRescheduleResponse = async (sessionId, response) => {
    try {
      const result = await axiosInstance.post(
        `/sessions/${sessionId}/reschedule_response/`,
        {
          response: response,
        },
      );

      await fetchSessions();

      const message =
        response === "accept"
          ? "Reschedule accepted successfully"
          : "Reschedule rejected, session cancelled";

      showToast(message, "success");

      return result;
    } catch (error) {
      const errorMessage =
        error.response?.data?.error || `Failed to ${response} reschedule`;
      showToast(errorMessage, "error");

      throw error;
    }
  };

  // Navigates to tutor profile and when clicking on review button
  const handleReviewClick = (tutorUsername) => {
    navigate(`/profile/${tutorUsername}?openReview=true`);
  };

  /**
   * Formats session date with special handling for rescheduled sessions
   *
   * @param {string} dateTimeString - ISO date string to format
   * @returns {string} Formatted date string
   */
  const formatSessionDate = (dateTimeString) => {
    if (
      lastRescheduledTime &&
      lastRescheduledTime.sessionId ===
        parseInt(dateTimeString.split("_")[0], 10)
    ) {
      // Create a date from the original string
      const [datePart, timePart] = dateTimeString.replace("Z", "").split("T");
      if (!datePart || !timePart) return dateTimeString;

      const [year, month, day] = datePart.split("-").map(Number);
      const dateObj = new Date(year, month - 1, day);

      // Format with custom time from lastRescheduledTime
      const formattedHours = lastRescheduledTime.hours
        .toString()
        .padStart(2, "0");
      const formattedMinutes = lastRescheduledTime.minutes
        .toString()
        .padStart(2, "0");

      const weekday = new Intl.DateTimeFormat("en-CH", {
        weekday: "long",
      }).format(dateObj);
      const monthName = new Intl.DateTimeFormat("en-CH", {
        month: "long",
      }).format(dateObj);

      return `${weekday}, ${day} ${monthName} ${year} at ${formattedHours}:${formattedMinutes}`;
    }

    return formatDateTime(dateTimeString);
  };

  /**
   * Renders session content including details and actions
   *
   * @param {Object} session - Session object to render
   * @returns {JSX.Element} Session content component
   */
  const renderSessionContent = (session) => {
    const formattedDate = formatSessionDate(session.date_time);

    let participantName;
    if (user) {
      if (user.id === session.tutor) {
        participantName = session.student_name;
      } else {
        participantName = session.tutor_name;
      }
    } else {
      participantName = session.tutor_name || session.student_name;
    }

    return (
      <div
        className={`session-item status-${session.status}`}
        data-session-id={session.id}
      >
        <div className="session-content">
          <div className="session-info">
            <h4
              onClick={() => navigateToProfile(participantName)}
              className="clickable-username"
            >
              Session with {participantName}
            </h4>
            <p className="session-time">{formattedDate}</p>

            {/* Duration */}
            <p className="session-duration">
              <strong>Duration:</strong> {formatDuration(session.duration)}
            </p>

            {/* Topic */}
            <p className="session-topic">
              <strong>Topic:</strong> {session.topic || "Not specified"}
            </p>

            {/* Mode */}
            <p className="session-mode">
              <strong>Mode:</strong> {formatSessionMode(session.mode)}
            </p>

            {renderSessionActions(session)}

            {/* Don't show the notes if it contains a reschedule request */}
            {session.notes &&
              !session.notes.includes("[RESCHEDULE_REQUEST]") && (
                <p className="session-notes">
                  <strong>Notes:</strong> {session.notes}
                </p>
              )}
          </div>
        </div>
      </div>
    );
  };

  const handleSessionAction = async (sessionId, action) => {
    try {
      await axiosInstance.post(`/sessions/${sessionId}/update_status/`, {
        status: action,
      });
      await fetchSessions();

      const actionMessage = action === "confirmed" ? "accepted" : "denied";
      showToast(`Session successfully ${actionMessage}`, "success");
    } catch (error) {
      showToast(
        error.response?.data?.detail || `Failed to ${action} session`,
        "error",
      );
    }
  };

  // Initiates session cancellation flow
  const handleCancelSession = (sessionId) => {
    setSessionToCancel(sessionId);
  };

  // Confirms and executes session cancellation
  const confirmCancelSession = async () => {
    try {
      await axiosInstance.post(`/sessions/${sessionToCancel}/update_status/`, {
        status: "cancelled",
      });
      await fetchSessions();
      showToast("Session successfully cancelled", "success");
      setSessionToCancel(null);
    } catch (error) {
      showToast(
        error.response?.data?.detail || "Failed to cancel session",
        "error",
      );
    }
  };

  const openRescheduleModal = (session) => {
    setSelectedSession(session);
    setShowRescheduleModal(true);
  };

  const closeRescheduleModal = () => {
    setShowRescheduleModal(false);
    setSelectedSession(null);
  };

  const handleRescheduleSuccess = (lastRescheduledTime) => {
    setLastRescheduledTime(lastRescheduledTime);
    setShowRescheduleModal(false);

    // Add the session ID to the list of rescheduled sessions
    if (selectedSession) {
      const updatedIds = [...rescheduledSessionIds, selectedSession.id];
      setRescheduledSessionIds(updatedIds);

      // Save to localStorage for persistence
      localStorage.setItem("rescheduledSessionIds", JSON.stringify(updatedIds));
    }

    fetchSessions();
    showToast("Session reschedule request sent to student", "success");
  };

  const handleRescheduleError = (errorMessage) => {
    showToast(errorMessage, "error");
  };

  /**
   * Renders session-specific action buttons based on:
   * - Session status
   * - User role
   * - Time constraints
   * - Review status
   *
   * @param {Object} session - Session to render actions for
   * @returns {JSX.Element|null} Action buttons or null
   */
  const renderSessionActions = (session) => {
    // Check if the user is a student and the session is completed - used for the review button
    const isStudent = user && session.student === user.id;
    const isCompleted = session.status === "completed";
    const tutorAlreadyReviewed = reviewedTutorIds.includes(session.tutor);
    const canReview = isStudent && isCompleted && !tutorAlreadyReviewed;

    // For pending booking requests (for tutors)
    if (session.status === "pending" && user && session.tutor === user.id) {
      return (
        <div className="session-actions">
          <button
            className="button button--success"
            onClick={() => handleSessionAction(session.id, "confirmed")}
          >
            Accept
          </button>
          <button
            className="button button--danger"
            onClick={() => handleSessionAction(session.id, "rejected")}
          >
            Deny
          </button>
        </div>
      );
    }

    // For pending reschedule requests (for students)
    if (
      session.status === "reschedule_pending" &&
      user &&
      session.student === user.id
    ) {
      return (
        <div className="session-actions">
          <button
            className="button button--success"
            onClick={() => handleRescheduleResponse(session.id, "accept")}
          >
            Accept
          </button>
          <button
            className="button button--danger"
            onClick={() => handleRescheduleResponse(session.id, "reject")}
          >
            Deny
          </button>
        </div>
      );
    }

    // Add reschedule and cancel options for confirmed sessions for tutors
    if (session.status === "confirmed" && user && session.tutor === user.id) {
      const sessionDate = new Date(session.date_time);
      const now = new Date();
      const sessionWasRescheduled = hasBeenRescheduled(session.id);

      // Only show these options for future sessions
      if (sessionDate > now) {
        return (
          <div className="session-actions">
            {sessionToCancel === session.id ? (
              <div className="confirm-cancel-container">
                <p>Are you sure?</p>
                <div>
                  <button
                    className="button button--close"
                    onClick={() => confirmCancelSession()}
                  >
                    Yes, Cancel
                  </button>
                  <button
                    className="button button--primary"
                    onClick={() => setSessionToCancel(null)}
                  >
                    No, Keep It
                  </button>
                </div>
              </div>
            ) : (
              <>
                {!sessionWasRescheduled && (
                  <button
                    className="button button--session"
                    onClick={() => openRescheduleModal(session)}
                  >
                    Reschedule
                  </button>
                )}
                <button
                  className="button button--danger"
                  onClick={() => handleCancelSession(session.id)}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        );
      }
    }

    // For confirmed sessions - add cancel option (for students)
    if (session.status === "confirmed" && user && session.student === user.id) {
      const sessionDate = new Date(session.date_time);
      const now = new Date();

      // Only show cancel option for future sessions
      if (sessionDate > now) {
        return (
          <div className="session-actions">
            {sessionToCancel === session.id ? (
              <div className="confirm-cancel-container">
                <p>Are you sure you want to cancel this session?</p>
                <div>
                  <button
                    className="button button--close"
                    onClick={() => confirmCancelSession()}
                  >
                    Yes, Cancel it
                  </button>
                  <button
                    className="button button--primary"
                    onClick={() => setSessionToCancel(null)}
                  >
                    No, Keep it
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="button button--danger"
                onClick={() => handleCancelSession(session.id)}
              >
                Cancel
              </button>
            )}
          </div>
        );
      }
    }

    // Only show the Review button if the tutor hasn't been reviewed yet
    if (canReview) {
      return (
        <div className="session-actions">
          <button
            className="button button--session"
            onClick={() => handleReviewClick(session.tutor_name)}
          >
            Review
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="page-container">
      <Navbar />

      {toastMessage && (
        <ToastNotifications
          message={toastMessage}
          type={toastType}
          onClose={clearToast}
        />
      )}

      <header className="page-header">
        <h2>Sessions</h2>
      </header>
      <div className="content-container">
        <div className="session-filters">
          <button
            className={`button button--session ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All Sessions
          </button>
          <button
            className={`button button--session ${filter === "upcoming" ? "active" : ""}`}
            onClick={() => setFilter("upcoming")}
          >
            Upcoming
          </button>
          <button
            className={`button button--session ${filter === "pending" ? "active" : ""}`}
            onClick={() => setFilter("pending")}
          >
            Pending
          </button>
          <button
            className={`button button--session ${filter === "completed" ? "active" : ""}`}
            onClick={() => setFilter("completed")}
          >
            Completed
          </button>
        </div>

        {loading ? (
          <div className="loading">Loading sessions...</div>
        ) : (
          <div className="sessions-list">
            {getFilteredSessions().length > 0 ? (
              getFilteredSessions().map((session) => (
                <div key={session.id}>{renderSessionContent(session)}</div>
              ))
            ) : (
              <div className="no-sessions">
                <p>
                  {filter === "all"
                    ? "No sessions found."
                    : `No ${filter} sessions found.`}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reschedule component */}
      {showRescheduleModal && selectedSession && (
        <Reschedule
          session={selectedSession}
          onClose={closeRescheduleModal}
          onSuccess={handleRescheduleSuccess}
          onError={handleRescheduleError}
        />
      )}
    </div>
  );
};

export default Sessions;
