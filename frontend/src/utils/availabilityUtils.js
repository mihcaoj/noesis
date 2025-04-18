/**
 * Utility functions for availability management and scheduling
 */

/**
 * Groups availability slots by week, with recurring slots in a separate category
 *
 * @param {Array} availabilities - List of availability slots to group
 * @param {boolean} [limitToFourWeeks=false] - Whether to limit results to 4 weeks
 * @returns {Object} Object with recurring slots and weeks arrays
 */
export function groupAvailabilitiesByWeek(
  availabilities,
  limitToFourWeeks = false,
) {
  // Extract recurring availabilities
  const recurring = availabilities.filter((slot) => slot.recurring);

  // Handle non-recurring availabilities
  const oneTimeSlots = availabilities.filter((slot) => !slot.recurring);
  const weeks = [];

  if (oneTimeSlots.length > 0) {
    // Get start of current week
    const today = new Date();
    const currentWeekStart = new Date(today);
    const daysSinceMonday = (today.getDay() + 6) % 7; // Monday is 0

    currentWeekStart.setDate(today.getDate() - daysSinceMonday);
    currentWeekStart.setHours(0, 0, 0, 0);

    const slotsByWeek = new Map();

    oneTimeSlots.forEach((slot) => {
      const slotDate = new Date(slot.available_date);

      // Get the Monday of the slot's week
      const weekStart = new Date(slotDate);
      const dayOfWeek = slotDate.getDay() || 7;
      const daysFromMonday = dayOfWeek - 1;
      weekStart.setDate(slotDate.getDate() - daysFromMonday);
      weekStart.setHours(0, 0, 0, 0);

      // Get the Sunday of the slot's week
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      // Create a key for this week
      const weekKey = weekStart.toISOString().split("T")[0];

      // Format week range for display
      const weekRangeStart = weekStart.toLocaleDateString("en-CH", {
        month: "short",
        day: "numeric",
      });
      const weekRangeEnd = weekEnd.toLocaleDateString("en-CH", {
        month: "short",
        day: "numeric",
      });
      const weekRange = `${weekRangeStart} - ${weekRangeEnd}`;

      // Add or update the week in map
      if (!slotsByWeek.has(weekKey)) {
        slotsByWeek.set(weekKey, {
          weekRange,
          slots: [],
          weekStart: new Date(weekStart),
        });
      }

      // Add slot to the appropriate week
      slotsByWeek.get(weekKey).slots.push(slot);
    });

    // Convert the map to an array and sort by week start date
    let sortedWeeks = Array.from(slotsByWeek.values()).sort(
      (a, b) => a.weekStart - b.weekStart,
    );

    // Take only the first four weeks
    if (limitToFourWeeks) {
      sortedWeeks = sortedWeeks.slice(0, 4);
    }

    // Map to the expected format and add to the result
    weeks.push(
      ...sortedWeeks.map(({ weekRange, slots }) => ({ weekRange, slots })),
    );
  }

  return { recurring, weeks };
}

/**
 * Gets weekday name from a date
 */
export function getWeekday(dateStr, makePlural = false) {
  const date = new Date(dateStr);
  const weekday = date.toLocaleDateString("en-CH", { weekday: "long" });
  return makePlural ? `${weekday}s` : weekday;
}

export function isAvailabilityInPast(availability) {
  // If it's recurring, it's always considered current
  if (availability.recurring) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const availabilityDate = new Date(availability.available_date);
  availabilityDate.setHours(0, 0, 0, 0);

  return availabilityDate < today;
}

export function filterCurrentAndFutureAvailabilities(availabilities) {
  return availabilities.filter(
    (availability) => !isAvailabilityInPast(availability),
  );
}
