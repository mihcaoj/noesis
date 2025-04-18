import axios from "axios";

/**
 * API Service
 *
 * Configures Axios for API communication with the following features:
 * - Authentication token management
 * - Automatic token refresh when expired
 * - Request/response interceptors
 * - Error handling with retry mechanisms
 * - Special handling for public endpoints
 */

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000/api";

const PUBLIC_ENDPOINTS = [
  "/tutors/",
  "/users/",
  "/topics/",
  "/register/",
  "/token/",
];

const axiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000, // 30 seconds
  headers: {
    "Content-Type": "application/json",
  },
});

axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

axiosInstance.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.config.url}`, response.data);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (!originalRequest) {
      console.error("API Error: No request configuration available", error);
      return Promise.reject(error);
    }

    // Error logging
    console.error("API Error:", {
      url: originalRequest?.url,
      method: originalRequest?.method,
      status: error.response?.status,
      data: error.response?.data,
    });

    const isPublicEndpoint = PUBLIC_ENDPOINTS.some((endpoint) =>
      originalRequest.url.includes(endpoint),
    );

    // Handle network errors
    if (!error.response) {
      if (!originalRequest._networkRetry) {
        originalRequest._networkRetry = true;
        console.log("Network error, retrying request after delay");

        // Wait a moment before retrying
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return axiosInstance(originalRequest);
      }

      window.dispatchEvent(
        new CustomEvent("network-error", {
          detail: {
            message: "No internet connection. Please check your network.",
            type: "error",
          },
        }),
      );
      return Promise.reject(error);
    }

    // Handle public endpoint 401 for GET requests
    if (
      error.response?.status === 401 &&
      isPublicEndpoint &&
      originalRequest.method.toLowerCase() === "get"
    ) {
      console.log(
        `Public endpoint ${originalRequest.url} returned 401, returning empty results`,
      );
      return Promise.resolve({ data: { results: [] } });
    }

    // Handle token refresh for non-public endpoints
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isPublicEndpoint
    ) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem("refresh_token");

      if (refreshToken) {
        try {
          const response = await axios.post(
            `${API_URL}/token/refresh/`,
            { refresh: refreshToken },
            { timeout: 5000 },
          );

          const newAccessToken = response.data.access;
          localStorage.setItem("access_token", newAccessToken);

          axiosInstance.defaults.headers["Authorization"] =
            `Bearer ${newAccessToken}`;
          originalRequest.headers["Authorization"] = `Bearer ${newAccessToken}`;

          return axiosInstance(originalRequest);
        } catch (refreshError) {
          console.error("Token refresh failed:", refreshError);

          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");

          // Redirect to login
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          console.log("Dispatching authChange event");
          window.dispatchEvent(new Event("authChange"));
          return Promise.reject(error);
        }
      }
    }

    // Handle network errors
    if (!error.response) {
      window.dispatchEvent(
        new CustomEvent("network-error", {
          detail: {
            message: "No internet connection. Please check your network.",
            type: "error",
          },
        }),
      );
    }

    return Promise.reject(error);
  },
);

export default axiosInstance;
