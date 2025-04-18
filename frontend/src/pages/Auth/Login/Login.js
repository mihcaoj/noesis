import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axiosInstance from "../../../services/api";
import Navbar from "../../../components/Layout/NavBar/NavBar";
import ToastNotifications from "../../../components/Common/ToastNotifications/ToastNotifications";
import { useAuth } from "../../../utils/useAuth";
import { useToast } from "../../../utils/hooks";
import "../../../pages/Home/Home.css";
import "./Login.css";

/**
 * Login Page
 *
 * Manages user authentication with the following features:
 * - Collecting login credentials
 * - Processing authentication with the API
 * - Storing authentication tokens
 * - Handling login errors
 */
const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);
  const { toastMessage, toastType, showToast, clearToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, userProfile } = useAuth();

  // Check for redirect param in URL
  const queryParams = new URLSearchParams(location.search);
  const redirectPath = queryParams.get("redirect") || "/";

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated && !isRedirecting) {
      navigate(redirectPath, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectPath, isRedirecting]);

  /**
   * Handles form submission and authenticates the user
   * Sends login credentials to the API and stores tokens on success
   *
   * @param {Event} e - Form submission event
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsRedirecting(true);

    try {
      const success = await login(username, password);

      if (success) {
        showToast("Login successful. Redirecting...", "success");

        // Small delay to ensure auth state is updated before navigating
        setTimeout(() => {
          navigate(redirectPath, { replace: true });
        }, 1000);
      } else {
        setIsRedirecting(false);
        showToast("Login failed. Please check your credentials.", "error");
      }
    } catch (error) {
      setIsRedirecting(false);
      console.error("Login error:", error);
      showToast("An unexpected error occurred. Please try again.", "error");
    }
  };

  return (
    <div className="page-container-flex">
      <Navbar hideLinks={true} />

      {toastMessage && (
        <ToastNotifications
          message={toastMessage}
          type={toastType}
          onClose={clearToast}
        />
      )}

      <header className="page-header">
        <h2>Login</h2>
      </header>

      <form className="form" onSubmit={handleSubmit}>
        <div>
          <label>Username:</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={isRedirecting}
          />
        </div>
        <div>
          <label>Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isRedirecting}
          />
        </div>
        <button
          type="submit"
          className="button button--primary login-button"
          disabled={isRedirecting}
        >
          {isRedirecting ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
};

export default Login;
