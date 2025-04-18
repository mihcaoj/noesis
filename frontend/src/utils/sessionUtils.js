/**
 * Utility functions for sessions
 */

export const isSessionUpcoming = (session) => {
  const sessionDate = new Date(session.date_time);
  const now = new Date();
  return (
    sessionDate > now &&
    ["confirmed", "pending", "reschedule_pending"].includes(session.status)
  );
};

export const isSessionCompleted = (session) => {
  return session.status === "completed";
};

export const isPendingSession = (session) => {
  return ["pending", "reschedule_pending"].includes(session.status);
};

/**
 * Formats a duration string
 *
 * @param {string} durationString - Duration in HH:MM format
 * @returns {string} Formatted duration (ex: "1h 30m" or "45 minutes")
 */
export const formatDuration = (durationString) => {
  if (!durationString) return "N/A";

  const parts = durationString.split(":");
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? "s" : ""}`;
  } else {
    return `${minutes} minute${minutes > 1 ? "s" : ""}`;
  }
};

export const formatSessionMode = (mode) => {
  switch (mode) {
    case "webcam":
      return "Webcam";
    case "in-person":
      return "In-Person";
    default:
      return mode || "Not specified";
  }
};
