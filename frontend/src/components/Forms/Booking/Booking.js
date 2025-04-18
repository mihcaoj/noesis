import React, { useState, useEffect } from "react";
import axiosInstance from "../../../services/api";
import ToastNotifications from "../../Common/ToastNotifications/ToastNotifications";
import { useToast } from "../../../utils/hooks";
import "../../Common/Buttons/Buttons.css";
import "./Booking.css";

/**
 * Booking Form
 *
 * Enables students to book sessions with tutors with the following features:
 * - Viewing available time slots based on tutor's availabilities
 * - Selecting session duration and topic of choice
 * - Choosing mode (webcam or in-person) based on tutor preferences
 * - Adding notes for the tutor about the session
 */
const Booking = ({ tutorId, availabilities, onClose }) => {
  const [selectedTime, setSelectedTime] = useState("");
  const [notes, setNotes] = useState("");
  const [topic, setTopic] = useState("");
  const [duration, setDuration] = useState("01:00:00");
  const [mode, setMode] = useState("");
  const { toastMessage, toastType, showToast, clearToast } = useToast();
  const [bookedSessions, setBookedSessions] = useState([]);
  const [tutorTopics, setTutorTopics] = useState([]);
  const [tutorInfo, setTutorInfo] = useState(null);

  useEffect(() => {
    const fetchBookedSessions = async () => {
      try {
        const response = await axiosInstance.get(`/sessions/?tutor=${tutorId}`);
        setBookedSessions(response.data.results || []);
      } catch (error) {
        console.error("Error fetching booked sessions:", error);
      }
    };

    const fetchTutorTopics = async () => {
      try {
        const response = await axiosInstance.get(`/users/${tutorId}/topics/`);

        setTutorTopics(response.data);

        // Set the first topic as default if topics exist
        if (response.data.length > 0) {
          setTopic(response.data[0]);
        }
      } catch (error) {
        console.error("Error fetching tutor topics:", error);
      }
    };

    const fetchTutorInfo = async () => {
      try {
        const response = await axiosInstance.get(`/users/${tutorId}/`);
        setTutorInfo(response.data);

        // Set default preferred mode based on tutor's preference
        if (response.data.preferred_mode) {
          setMode(response.data.preferred_mode);
        }
      } catch (error) {
        console.error("Error fetching tutor information:", error);
      }
    };

    fetchBookedSessions();
    fetchTutorTopics();
    fetchTutorInfo();
  }, [tutorId]);

  /**
   * Generates available time slots from tutor availabilities
   *
   * @returns {Array} List of available time slots
   */
  const getAvailableTimeSlots = () => {
    const slots = [];
    const today = new Date();
    const maxWeeks = 4;

    availabilities.forEach((slot) => {
      if (slot.recurring) {
        // For recurring slots, generate next occurrences
        const originalDate = new Date(slot.available_date);
        const dayOfWeek = originalDate.getDay();

        for (let week = 0; week < maxWeeks; week++) {
          // Calculate the next occurrence date
          const futureDate = new Date(today);

          // Find the next matching weekday
          const daysToAdd = (dayOfWeek - futureDate.getDay() + 7) % 7;
          futureDate.setDate(futureDate.getDate() + daysToAdd + week * 7);

          // Skip dates in the past
          if (futureDate < today) continue;

          const formattedDate = futureDate.toISOString().split("T")[0];

          slots.push({
            id: `${slot.id}-${week}`,
            available_date: formattedDate,
            available_time_start: slot.available_time_start,
            available_time_end: slot.available_time_end,
            isRecurring: true,
          });
        }
      } else {
        // Non-recurring slots
        slots.push({ ...slot, isRecurring: false });
      }
    });

    // Filter out already booked slots
    return slots
      .filter((slot) => {
        const slotDateTime = new Date(
          `${slot.available_date}T${slot.available_time_start}`,
        );

        // Check if this slot is in the future
        if (slotDateTime <= new Date()) {
          return false;
        }

        // Check if this slot is already booked
        const isBooked = bookedSessions.some((session) => {
          const sessionDate = new Date(session.date_time);
          const slotEndTime = new Date(
            `${slot.available_date}T${slot.available_time_end}`,
          );

          return (
            session.status !== "rejected" &&
            session.status !== "cancelled" &&
            sessionDate >= slotDateTime &&
            sessionDate <= slotEndTime
          );
        });

        return !isBooked;
      })
      .sort((a, b) => {
        // Sort by date and time
        const dateA = new Date(`${a.available_date}T${a.available_time_start}`);
        const dateB = new Date(`${b.available_date}T${b.available_time_start}`);
        return dateA - dateB;
      });
  };

  /**
   * Formats a time slot for display
   *
   * @param {Object} slot - Time slot to format
   * @returns {string} Formatted time slot string
   */
  const formatTimeSlot = (slot) => {
    const slotDate = new Date(
      `${slot.available_date}T${slot.available_time_start}`,
    );

    // Format: Thu, 20 February 2025: 15:00-18:00 (Recurring)
    const dateStr = slotDate.toLocaleDateString("en-CH", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const startTime = new Date(
      `1970-01-01T${slot.available_time_start}`,
    ).toLocaleTimeString("en-CH", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const endTime = new Date(
      `1970-01-01T${slot.available_time_end}`,
    ).toLocaleTimeString("en-CH", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    return `${dateStr}, ${startTime} - ${endTime}`;
  };

  const validateDuration = () => {
    const selectedSlot = availableSlots.find((slot) => {
      return (
        `${slot.available_date}T${slot.available_time_start}` === selectedTime
      );
    });

    if (!selectedSlot) return true;

    // Calculate slot duration in minutes
    const startTime = new Date(
      `1970-01-01T${selectedSlot.available_time_start}`,
    );
    const endTime = new Date(`1970-01-01T${selectedSlot.available_time_end}`);
    const slotDurationMinutes = (endTime - startTime) / (1000 * 60);

    // Calculate selected duration in minutes
    const [hours, minutes] = duration.split(":").map(Number);
    const selectedDurationMinutes = hours * 60 + minutes;

    // Check if selected duration fits within the slot
    return selectedDurationMinutes <= slotDurationMinutes;
  };

  /**
   * Handles form submission for booking a session
   *
   * @param {Object} e - Event object from form submission
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Check if the selected duration fits in the time slot
    if (!validateDuration()) {
      showToast(
        "The selected duration is longer than the selected time slot",
        "error",
      );
      return;
    }

    const requestData = {
      tutor: Number(tutorId),
      date_time: selectedTime,
      status: "pending",
      duration: duration,
      notes: notes,
      topic: topic,
      mode: mode,
    };

    try {
      const response = await axiosInstance.post("/sessions/", requestData);
      console.log("Booking response:", response.data);

      showToast("Booking request sent successfully", "success");
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error("Error details:", error.response?.data);
      const errorMessage =
        error.response?.data?.error || "Failed to send booking request.";
      showToast(errorMessage, "error");
    }
  };

  const availableSlots = getAvailableTimeSlots();

  /**
   * Gets available session modes based on tutor preferences
   *
   * @returns {Array} List of available modes
   */
  const getAvailableModes = () => {
    if (!tutorInfo || !tutorInfo.preferred_mode) {
      return ["webcam", "in-person"];
    }

    if (tutorInfo.preferred_mode === "both") {
      return ["webcam", "in-person"];
    }

    // If tutor only prefers one mode, only offer that mode
    return [tutorInfo.preferred_mode];
  };

  const availableModes = getAvailableModes();

  const formatMode = (mode) => {
    switch (mode) {
      case "webcam":
        return "Webcam";
      case "in-person":
        return "In-Person";
      default:
        return mode;
    }
  };

  return (
    <div className="popout-form booking-form">
      <h3>Book a Session</h3>

      <ToastNotifications
        message={toastMessage}
        type={toastType}
        onClose={clearToast}
      />

      <div className="booking-form-container">
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label>Available Time Slots:</label>
            <select
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              required
            >
              <option value="">Choose a time slot</option>
              {availableSlots.length > 0 ? (
                availableSlots.map((slot) => (
                  <option
                    key={slot.id}
                    value={`${slot.available_date}T${slot.available_time_start}`}
                  >
                    {formatTimeSlot(slot)}
                  </option>
                ))
              ) : (
                <option value="" disabled>
                  No available time slots
                </option>
              )}
            </select>
          </div>

          <div className="form-field">
            <label>Session Duration:</label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              required
            >
              <option value="">Choose a duration</option>
              <option value="01:00:00">1 hour</option>
              <option value="01:30:00">1 hour 30 minutes</option>
              <option value="02:00:00">2 hours</option>
              <option value="02:30:00">2 hours 30 minutes</option>
              <option value="03:00:00">3 hours</option>
            </select>
          </div>

          <div className="form-field">
            <label>Topic:</label>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              required
            >
              <option value="">Choose a topic</option>
              {tutorTopics.map((topicName, index) => (
                <option key={index} value={topicName}>
                  {topicName}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Mode:</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              required
            >
              <option value="">Choose a mode</option>
              {availableModes.map((mode) => (
                <option key={mode} value={mode}>
                  {formatMode(mode)}
                </option>
              ))}
            </select>
            {tutorInfo &&
              tutorInfo.preferred_mode &&
              tutorInfo.preferred_mode !== "both" && (
                <p className="mode-info">
                  <strong>Note:</strong> This tutor only offers{" "}
                  {formatMode(tutorInfo.preferred_mode)} sessions.
                </p>
              )}
          </div>

          <div className="form-field">
            <label>Notes (Optional):</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any specific requirements or things you would like the tutor to know..."
            />
          </div>

          <div className="button-container">
            <button
              type="submit"
              className="button button--primary"
              disabled={availableSlots.length === 0 || !selectedTime}
            >
              Send Request
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

export default Booking;
