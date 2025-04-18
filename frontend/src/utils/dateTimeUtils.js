/**
 * Utility functions for date and time formatting
 */

/**
 * Formats a date as a full date string
 *
 * @param {string|Date} dateStr - Date string or Date object
 * @returns {string} - Formatted date in "Weekday, Day Month" format (ex: "Monday, 15 April")
 */
export const formatDate = (dateStr) => {
  try {
    return new Date(dateStr).toLocaleDateString("en-CH", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } catch (e) {
    console.error("Date formatting error:", e);
    return dateStr;
  }
};

/**
 * Formats a time string in 24-hour format
 *
 * @param {string} timeStr - Time string in HH:MM:SS format
 * @returns {string} - Formatted time in 24-hour format (ex: "14:30")
 */
export const formatTime = (timeStr) => {
  try {
    return new Date(`1970-01-01T${timeStr}`).toLocaleTimeString("en-CH", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch (e) {
    console.error("Time formatting error:", e);
    return timeStr;
  }
};

/**
 * Formats a date-time string as a combined date and time
 *
 * @param {string|Date} dateTimeStr - Date-time string or Date object
 * @returns {string} - Formatted date and time (ex: "Monday, 15 April, 14:30")
 */
export const formatDateTime = (dateTimeStr) => {
  try {
    const date = new Date(dateTimeStr);
    return `${formatDate(date)}, ${date.toLocaleTimeString("en-CH", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })}`;
  } catch (e) {
    console.error("DateTime formatting error:", e);
    return dateTimeStr;
  }
};
