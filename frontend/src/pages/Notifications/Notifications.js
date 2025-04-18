import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../services/api";
import Navbar from "../../components/Layout/NavBar/NavBar";
import "./Notifications.css";

/**
 * Notifications Page
 *
 * Manages notifications with the following features:
 * - Displaying read/unread notifications
 * - Marking notifications as read
 * - Deleting notifications
 * - Navigating to related session by clicking on a notification
 */
const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const response = await axiosInstance.get("/notifications/");
      const notificationsArray = response.data.results || [];
      setNotifications(notificationsArray);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      setNotifications([]);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  // Marks a notification as read
  const markAsRead = async (notificationId) => {
    try {
      await axiosInstance.post(
        `/notifications/${notificationId}/mark_as_read/`,
      );
      fetchNotifications();
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  // Marks all notifications as read
  const markAllAsRead = async () => {
    try {
      await axiosInstance.post("/notifications/mark_all_as_read/");
      fetchNotifications();
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  };

  // Deletes a notification
  const handleDelete = async (notificationId, e) => {
    e.stopPropagation();
    try {
      await axiosInstance.delete(`/notifications/${notificationId}/`);
      fetchNotifications();
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  /**
   * Renders notification content with formatted message and timestamp
   *
   * @param {Object} notification - Notification object containing:
   *   @property {string} id - Notification ID
   *   @property {string} title - Notification title
   *   @property {string} message - Notification message (may contain "Notes:" separator)
   *   @property {string} created_at - ISO timestamp of notification creation
   *
   * @returns {JSX.Element} Notification component
   */
  const renderNotificationContent = (notification) => {
    const formatNotificationMessage = (message) => {
      const parts = message.split("Notes:");
      if (parts.length > 1) {
        return (
          <>
            <p>{parts[0]}</p>
            <span className="notification-time">
              {new Date(notification.created_at).toLocaleString("en-CH", {
                weekday: "long",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "numeric",
                minute: "2-digit",
                hour12: false,
              })}
            </span>
          </>
        );
      }
      return (
        <>
          <p>{message}</p>
          <span className="notification-time">
            {new Date(notification.created_at).toLocaleString("en-CH", {
              weekday: "long",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "numeric",
              minute: "2-digit",
              hour12: false,
            })}
          </span>
        </>
      );
    };

    return (
      <div className="notification-content">
        <button
          className="delete-notification-button"
          onClick={(e) => handleDelete(notification.id, e)}
        >
          ×
        </button>
        <div className="notification-text">
          <h4>{notification.title}</h4>
          {formatNotificationMessage(notification.message)}
        </div>
      </div>
    );
  };

  const hasUnreadNotifications =
    Array.isArray(notifications) &&
    notifications.some((notification) => !notification.is_read);

  return (
    <div className="notifications-page page-container">
      <Navbar />
      <header className="page-header">
        <h2>Notifications</h2>
      </header>
      <div className="content-container">
        {hasUnreadNotifications && (
          <button
            className="button button--primary mark-all-read-button"
            onClick={markAllAsRead}
          >
            Mark all as read
          </button>
        )}
        {loading ? (
          <div className="loading">Loading notifications...</div>
        ) : notifications.length > 0 ? (
          <div className="notifications-list">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`notification-item ${!notification.is_read ? "unread" : ""}`}
                onClick={() => {
                  markAsRead(notification.id);
                  navigate(
                    `/sessions?sessionId=${notification.related_session}`,
                  );
                }}
              >
                {renderNotificationContent(notification)}
              </div>
            ))}
          </div>
        ) : (
          <div className="no-notifications">
            <p>No notifications yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
