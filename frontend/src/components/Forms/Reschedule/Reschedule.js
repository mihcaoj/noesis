import React, { useState } from "react";
import axiosInstance from "../../../services/api";
import "../../Common/Buttons/Buttons.css";
import "./Reschedule.css";

/**
 * Reschedule Form
 *
 * Allows tutors to reschedule existing sessions with the following features:
 * - Selecting new date and time for the session
 * - Validation to prevent scheduling conflicts
 * - Confirmation workflow for changes
 * - Error handling for failed reschedule attempts
 */
const Reschedule = ({ session, onClose, onSuccess, onError }) => {
  const currentSessionDate = new Date(session.date_time);
  const currentDateString = currentSessionDate.toISOString().split("T")[0]; // YYYY-MM-DD
  const currentTimeString = currentSessionDate
    .toTimeString()
    .split(" ")[0]
    .substring(0, 5); // HH:MM
  const [rescheduleDate, setRescheduleDate] = useState(currentDateString);
  const [rescheduleTime, setRescheduleTime] = useState(currentTimeString);

  const handleDateChange = (e) => {
    setRescheduleDate(e.target.value);
  };

  const handleTimeChange = (e) => {
    setRescheduleTime(e.target.value);
  };

  /**
   * Handles reschedule form submission
   *
   * @param {Object} e - Event object from form submission
   */
  const handleRescheduleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!rescheduleDate || !rescheduleTime) {
      onError("Please select a date and time");
      return;
    }

    // Check if the new date and time are the same as the current session
    if (
      rescheduleDate === currentDateString &&
      rescheduleTime === currentTimeString
    ) {
      onError("The selected date and time are the same as the current session");
      return;
    }

    try {
      const localDateTime = `${rescheduleDate}T${rescheduleTime}`;

      // Store the exact time the user input for using in display
      const [hours, minutes] = rescheduleTime.split(":").map(Number);
      const lastRescheduledTime = {
        sessionId: session.id,
        hours,
        minutes,
      };

      const response = await axiosInstance.post(
        `/sessions/${session.id}/reschedule/`,
        {
          date_time: localDateTime,
        },
      );

      console.log("Reschedule response:", response);
      onSuccess(lastRescheduledTime);
    } catch (error) {
      console.error("Reschedule error:", error);
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.detail ||
        "Failed to reschedule session";
      onError(errorMessage);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="popout-form reschedule-form">
        <h3>Reschedule Session</h3>
        <form onSubmit={handleRescheduleSubmit}>
          <div className="form-field">
            <label>New Date:</label>
            <input
              type="date"
              id="reschedule-date"
              value={rescheduleDate}
              onChange={handleDateChange}
              min={new Date().toISOString().split("T")[0]}
              required
            />
          </div>
          <div className="form-field">
            <label>New Time:</label>
            <input
              type="time"
              id="reschedule-time"
              value={rescheduleTime}
              onChange={handleTimeChange}
              required
            />
          </div>
          <div className="button-container">
            <button type="submit" className="button button--success">
              Confirm
            </button>
            <button
              type="button"
              className="button button--close"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Reschedule;
