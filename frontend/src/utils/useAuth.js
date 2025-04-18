import React, { useState, useEffect, useRef, useCallback } from "react";
import axiosInstance from "../services/api";

/**
 * Custom hook for managing authentication state and token validation
 * @returns {Object} Authentication management utilities
 */
export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const authCheckInProgress = useRef(false);
  const authChangeTimeout = useRef(null);

  const validateToken = useCallback(async () => {
    // Prevent multiple simultaneous validation attempts
    if (authCheckInProgress.current) {
      return isAuthenticated;
    }

    const token = localStorage.getItem("access_token");
    if (!token) {
      setIsAuthenticated(false);
      setUserProfile(null);
      setIsLoading(false);
      return false;
    }

    try {
      authCheckInProgress.current = true;
      const response = await axiosInstance.get("/profile/");
      setUserProfile(response.data);
      setIsAuthenticated(true);
      setIsLoading(false);
      authCheckInProgress.current = false;
      return true;
    } catch (error) {
      console.error("Token validation failed:", error);
      // Clear invalid tokens
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      setIsAuthenticated(false);
      setUserProfile(null);
      setIsLoading(false);
      authCheckInProgress.current = false;

      // Dispatch auth change event
      window.dispatchEvent(new Event("authChange"));
      return false;
    }
  }, [isAuthenticated]);

  // Check authentication on initial load
  useEffect(() => {
    validateToken();

    const handleAuthChange = () => {
      if (authChangeTimeout.current) {
        clearTimeout(authChangeTimeout.current);
      }

      // Small delay to ensure token is properly saved in localStorage
      authChangeTimeout.current = setTimeout(() => {
        validateToken();
      }, 300);
    };

    window.addEventListener("storage", handleAuthChange);
    window.addEventListener("authChange", handleAuthChange);

    return () => {
      window.removeEventListener("storage", handleAuthChange);
      window.removeEventListener("authChange", handleAuthChange);
      if (authChangeTimeout.current) {
        clearTimeout(authChangeTimeout.current);
      }
    };
  }, [validateToken]);

  const login = async (username, password) => {
    try {
      const response = await axiosInstance.post("/token/", {
        username,
        password,
      });

      const { access, refresh } = response.data;

      if (access && refresh) {
        localStorage.setItem("access_token", access);
        localStorage.setItem("refresh_token", refresh);

        // Wait a moment before dispatching auth change to ensure localStorage is updated
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Validate token and fetch profile immediately after login
        await validateToken();

        // Dispatch auth change event after validation
        window.dispatchEvent(new Event("authChange"));

        return true;
      }

      return false;
    } catch (error) {
      console.error("Login failed:", error);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUserProfile(null);
    setIsAuthenticated(false);

    window.dispatchEvent(new Event("authChange"));
  };

  const protectedRoute = async (navigateCallback) => {
    // Small delay to ensure auth state is current
    setTimeout(async () => {
      const isValid = await validateToken();
      if (isValid) {
        navigateCallback();
      } else {
        // Redirect to login if token is invalid
        window.location.href = "/login";
      }
    }, 100);
  };

  return {
    isAuthenticated,
    isLoading,
    userProfile,
    login,
    logout,
    validateToken,
    protectedRoute,
  };
};

export const useNavigation = (navigate) => {
  const { protectedRoute } = useAuth();

  const handleProtectedNavigation = (path) => {
    protectedRoute(() => navigate(path));
  };

  return { handleProtectedNavigation };
};
