import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../../utils/useAuth";
import axiosInstance from "../../../services/api";
import "./NavBar.css";

/**
 * Navigation Bar Component
 *
 * Provides application navigation with the following features:
 * - Hamburger menu
 * - Different display based on authentication status
 * - Unread indicators for messages and notifications
 */
const Navbar = ({ hideLinks = false }) => {
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, isAuthenticated, userProfile } = useAuth();
  const isLoggedIn = isAuthenticated;
  const menuContainerRef = useRef(null);
  const hasInitiallyFetched = useRef(false);

  const username = userProfile?.username;

  // Fetches unread notifications count
  const fetchUnreadNotifications = useCallback(async () => {
    if (isLoggedIn) {
      try {
        const notificationsResponse =
          await axiosInstance.get("/notifications/");
        const unreadNotifications = notificationsResponse.data.results.filter(
          (notification) => !notification.is_read,
        );
        setUnreadNotifs(unreadNotifications.length);
      } catch (error) {
        console.error("Failed to fetch unread notifications:", error);
      }
    }
  }, [isLoggedIn]);

  // Fetches unread messages count
  const fetchUnreadMessages = useCallback(async () => {
    if (isLoggedIn) {
      try {
        const messagesResponse = await axiosInstance.get(
          "/messages/unread-count",
        );
        setUnreadMessages(messagesResponse.data.unread_count);
      } catch (error) {
        console.error("Failed to fetch unread messages count:", error);
      }
    }
  }, [isLoggedIn]);

  // Fetch notifications on component mount
  useEffect(() => {
    if (isLoggedIn && !hasInitiallyFetched.current) {
      fetchUnreadNotifications();
      hasInitiallyFetched.current = true;
    }
  }, [isLoggedIn, fetchUnreadNotifications]);

  // Fetch unread messages count only when menu is opened or on messages page
  useEffect(() => {
    if (isMenuOpen || location.pathname === "/messages") {
      fetchUnreadMessages();
    }
  }, [isMenuOpen, location.pathname, fetchUnreadMessages]);

  // Fetch notifications counts when menu is opened
  useEffect(() => {
    if (isMenuOpen) {
      fetchUnreadNotifications();
    }
  }, [isMenuOpen, fetchUnreadNotifications]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(event.target) &&
        isMenuOpen
      ) {
        setMenuOpen(false);
      }
    };

    // Event listener when menu is open
    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    // Cleanup event listener
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  // Logout handler
  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Protected navigation handler
  const handleProtectedNavigation = (path) => {
    if (isLoggedIn) {
      navigate(path);
    } else {
      navigate("/login");
    }
  };

  // Toggles the dropdown menu open and closed
  const toggleMenu = () => {
    setMenuOpen((prev) => !prev);
  };

  // Handle profile navigation
  const handleProfileNavigation = () => {
    if (isLoggedIn && username) {
      handleProtectedNavigation(`/profile/${username}`);
    } else if (isLoggedIn) {
      setTimeout(() => {
        if (userProfile?.username) {
          handleProtectedNavigation(`/profile/${userProfile.username}`);
        } else {
          console.error("Username not available for profile navigation.");
          handleProtectedNavigation("/");
        }
      }, 300);
    } else {
      handleProtectedNavigation("/login");
    }
  };

  return (
    <nav className="navbar">
      {/* App Name */}
      <Link to="/" className="app-name">
        Noesis
      </Link>
      {isLoggedIn ? (
        <div className="menu-container" ref={menuContainerRef}>
          {/* Hamburger Menu */}
          <div
            className={`hamburger-menu ${isMenuOpen ? "active" : ""}`}
            onClick={toggleMenu}
          >
            <div></div>
            <div></div>
            <div></div>
          </div>
          {/* Dropdown Menu */}
          {isMenuOpen && (
            <ul className="dropdown-menu">
              <li onClick={() => handleProtectedNavigation("/")}>Home</li>
              <li onClick={handleProfileNavigation}>Profile</li>
              <li onClick={() => handleProtectedNavigation("/messages")}>
                Messages
                {unreadMessages > 0 && (
                  <span className="unread-stuff notification-count">
                    {unreadMessages}
                  </span>
                )}
              </li>
              <li onClick={() => handleProtectedNavigation("/notifications")}>
                Notifications
                {unreadNotifs > 0 && (
                  <span className="unread-stuff notification-count">
                    {unreadNotifs}
                  </span>
                )}
              </li>
              <li onClick={() => handleProtectedNavigation("/sessions")}>
                Sessions
              </li>
              <li onClick={() => handleProtectedNavigation("/settings")}>
                Settings
              </li>
              <li onClick={handleLogout}>Log Out</li>
            </ul>
          )}
        </div>
      ) : (
        <div className="auth-links">
          <a href="/register">Register</a>
          <a href="/login">Log In</a>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
