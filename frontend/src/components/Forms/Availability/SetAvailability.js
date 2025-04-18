import React, { useState, useEffect, useMemo } from "react";
import axiosInstance from "../../../services/api";
import ToastNotifications from "../../Common/ToastNotifications/ToastNotifications";
import { useToast } from "../../../utils/hooks";
import { formatDate, formatTime } from "../../../utils/dateTimeUtils";
import {
  groupAvailabilitiesByWeek,
  getWeekday,
  filterCurrentAndFutureAvailabilities,
} from "../../../utils/availabilityUtils";
import "../../Common/Buttons/Buttons.css";
import "./SetAvailability.css";

/**
 * Set Availability Form
 *
 * Allows tutors to manage their availability with the following features:
 * - Adding new availability slots
 * - Option for recurring availabilities
 * - Viewing and deleting existing availabilities
 * - Organized display of availabilities by week
 */
const SetAvailability = ({ onCancel, onSave, onDelete }) => {
  const [availabilities, setAvailabilities] = useState([]);
  // eslint-disable-next-line
  const [editingAvailability, setEditingAvailability] = useState(null);
  const [newAvailability, setNewAvailability] = useState({
    available_date: "",
    available_time_start: "",
    available_time_end: "",
    recurring: false,
  });
  const { toastMessage, toastType, showToast, clearToast } = useToast();
  const [sessions, setSessions] = useState([]);

  // Filter availabilities to only show current and future ones
  const currentAndFutureAvailabilities = useMemo(
    () => filterCurrentAndFutureAvailabilities(availabilities),
    [availabilities],
  );

  // Group the filtered availabilities for display
  const groupedAvailabilities = useMemo(
    () => groupAvailabilitiesByWeek(currentAndFutureAvailabilities),
    [currentAndFutureAvailabilities],
  );

  // Fetches the user's current availability
  const fetchAvailabilities = async () => {
    try {
      const response = await axiosInstance.get("/set-availability/");
      setAvailabilities(response.data);
    } catch (error) {
      console.error("Error fetching availabilities:", error);
    }
  };

  // Fetches all sessions for the tutor to check against availability slots
  const fetchSessions = async () => {
    try {
      const response = await axiosInstance.get("/sessions/");
      setSessions(response.data.results || []);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      setSessions([]);
    }
  };

  // Fetch availabilities and sessions on component mount
  useEffect(() => {
    fetchAvailabilities();
    fetchSessions();
  }, []);

  /**
   * Handles input changes in the form, including checkboxes
   *
   * @param {Object} e - Event object from input field
   */
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNewAvailability((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  /**
   * Handles form submission to save availability
   *
   * @param {Object} e - Event object from form submission
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Create a new availability
      const response = await axiosInstance.post("/set-availability/", [
        newAvailability,
      ]);
      const newData = Array.isArray(response.data)
        ? response.data
        : [response.data];
      setAvailabilities((prev) => [...prev, ...newData]);

      // Show success message
      showToast("Availability saved successfully", "success");

      // Reset form
      setNewAvailability({
        available_date: "",
        available_time_start: "",
        available_time_end: "",
        recurring: false,
      });
    } catch (error) {
      console.error("Error saving availability:", error);
      showToast("Failed to save availability", "error");
    }
  };

  /**
   * Checks if the availability slot has any booked sessions
   *
   * @param {Object} availability - The availability slot to check
   * @returns {boolean} True if the slot has booked sessions, false otherwise
   */
  const hasBookedSessions = (availability) => {
    // Convert availability times to Date objects for comparison
    const availabilityDate = new Date(availability.available_date);
    const startTime = availability.available_time_start.split(":");
    const endTime = availability.available_time_end.split(":");

    const availabilityStart = new Date(availabilityDate);
    availabilityStart.setHours(
      parseInt(startTime[0], 10),
      parseInt(startTime[1], 10),
      0,
    );

    const availabilityEnd = new Date(availabilityDate);
    availabilityEnd.setHours(
      parseInt(endTime[0], 10),
      parseInt(endTime[1], 10),
      0,
    );

    // Check for sessions that overlap with this availability
    const overlappingSessions = sessions.filter((session) => {
      if (session.status === "cancelled" || session.status === "rejected") {
        return false;
      }

      const sessionDateTime = new Date(session.date_time);

      // For recurring availabilities, check if the session falls on the same day of week
      if (availability.recurring) {
        return (
          sessionDateTime.getDay() === availabilityStart.getDay() &&
          sessionDateTime.getHours() >= availabilityStart.getHours() &&
          sessionDateTime.getHours() < availabilityEnd.getHours()
        );
      }

      // For non-recurring, check if session falls within the availability window
      return (
        sessionDateTime >= availabilityStart &&
        sessionDateTime < availabilityEnd
      );
    });

    return overlappingSessions.length > 0;
  };

  /**
   * Handles deletion of an availability slot
   *
   * @param {number} id - ID of the availability slot to delete
   * @param {Object} availability - The availability slot object
   */
  const handleDelete = async (id, availability) => {
    const hasBookedSession = hasBookedSessions(availability);

    // If sessions exist, show error and block deletion
    if (hasBookedSession) {
      showToast(
        "Cannot delete availability with booked sessions. This time slot has already been booked.",
        "error",
      );
      return;
    }

    // No sessions are booked, proceed with deletion
    try {
      await axiosInstance.delete("/set-availability/", {
        data: { id: id },
      });

      showToast("Availability deleted successfully", "success");
      fetchAvailabilities();

      if (onDelete) {
        onDelete(id);
      }
    } catch (error) {
      console.error("Error deleting availability:", error);
      showToast("Failed to delete availability", "error");
    }
  };

  // Handles canceling the form input, resets fields and clears messages
  const handleCancel = () => {
    setNewAvailability({
      available_date: "",
      available_time_start: "",
      available_time_end: "",
      recurring: false,
    });
    setEditingAvailability(null);
    clearToast();
    onCancel();
  };

  // Delete button for an availability slot
  const renderDeleteButton = (availability) => {
    return (
      <button
        className="button button--close delete-availability-button"
        onClick={() => handleDelete(availability.id, availability)}
      >
        Delete
      </button>
    );
  };

  return (
    <div className="popout-form set-availability">
      <h3>Set Availability</h3>
      {/* Toast notifications */}
      <ToastNotifications
        message={toastMessage}
        type={toastType}
        onClose={clearToast}
      />

      {/* Availability Form */}
      <form onSubmit={handleSubmit}>
        <label>
          Date:
          <input
            type="date"
            name="available_date"
            value={newAvailability.available_date}
            onChange={handleInputChange}
            required
          />
        </label>
        <label>
          Start Time:
          <input
            type="time"
            name="available_time_start"
            value={newAvailability.available_time_start}
            onChange={handleInputChange}
            required
          />
        </label>
        <label>
          End Time:
          <input
            type="time"
            name="available_time_end"
            value={newAvailability.available_time_end}
            onChange={handleInputChange}
            required
          />
        </label>
        <label>
          Recurring:
          <input
            type="checkbox"
            name="recurring"
            checked={newAvailability.recurring}
            onChange={handleInputChange}
          />
        </label>
        <div className="button-container">
          <button type="submit" className="button button--primary">
            Save
          </button>
          <button
            type="button"
            className="button button--close"
            onClick={handleCancel}
          >
            Close
          </button>
        </div>
      </form>

      {/* List of existing Availabilities */}
      <div className="availability-list">
        <h4>Current Availabilities:</h4>
        {currentAndFutureAvailabilities.length > 0 ? (
          <div className="set-availability-sections">
            {/* Recurring Availabilities Section */}
            {groupedAvailabilities.recurring.length > 0 && (
              <div className="availability-section">
                <h4 className="availability-week-header">Recurring</h4>
                <ul>
                  {groupedAvailabilities.recurring.map((availability) => (
                    <li key={availability.id}>
                      {`${getWeekday(availability.available_date, true)}, `}
                      {formatTime(availability.available_time_start)}
                      {" - "}
                      {formatTime(availability.available_time_end)}
                      {renderDeleteButton(availability)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* One-time Availabilities by Week */}
            {groupedAvailabilities.weeks.map((week, index) => (
              <div key={index} className="availability-section">
                <h4 className="availability-week-header">{week.weekRange}</h4>
                <ul>
                  {week.slots.map((availability) => (
                    <li key={availability.id}>
                      {formatDate(availability.available_date)}
                      {", "}
                      {formatTime(availability.available_time_start)}
                      {" - "}
                      {formatTime(availability.available_time_end)}
                      {renderDeleteButton(availability)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: "#9DB2BF" }}>No availabilities set.</p>
        )}
      </div>
    </div>
  );
};

export default SetAvailability;
