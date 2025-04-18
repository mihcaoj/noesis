import React, { useEffect, useState } from "react";
import "./ToastNotifications.css";

/**
 * Toast Notifications Component
 *
 * Displays temporary notification messages
 */
const ToastNotifications = ({ message = "", type = "success", onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    if (message) {
      setIsVisible(true);
      setIsLeaving(false);

      const hideTimeout = setTimeout(() => {
        setIsLeaving(true);
        setTimeout(() => {
          setIsVisible(false);
          onClose();
        }, 300);
      }, 3000);

      return () => clearTimeout(hideTimeout);
    }
  }, [message, onClose]);

  if (!isVisible) return null;

  return (
    <div className={`toast-notification ${type} ${isLeaving ? "leaving" : ""}`}>
      <span className="message">{message}</span>
      <button className="close-button" onClick={() => setIsLeaving(true)}>
        ×
      </button>
    </div>
  );
};

export default ToastNotifications;
