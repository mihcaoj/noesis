import { useState, useCallback } from "react";

/**
 * Hook for managing toast notifications
 *
 * @returns {Object} Toast state and controller functions
 */
export const useToast = () => {
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");

  const showToast = useCallback((message, type = "success") => {
    setToastMessage(message);
    setToastType(type);
  }, []);

  const clearToast = useCallback(() => setToastMessage(""), []);

  return { toastMessage, toastType, showToast, clearToast };
};
