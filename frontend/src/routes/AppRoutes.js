import React from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from "react-router-dom";
import { useAuth } from "../utils/useAuth";
import Home from "../pages/Home/Home";
import Login from "../pages/Auth/Login/Login";
import Register from "../pages/Auth/Register/Register";
import Profile from "../pages/Profile/Profile";
import Messages from "../pages/Messages/Messages";
import Settings from "../pages/Settings/Settings";
import Notifications from "../pages/Notifications/Notifications";
import Sessions from "../pages/Sessions/Sessions";
import ScrollToTop from "../utils/scrollToTop";

const AppRoutes = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Router>
      <ScrollToTop />
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/" replace />
            ) : (
              <Login />
            )
          }
        />
        <Route
          path="/register"
          element={isAuthenticated ? <Navigate to="/" replace /> : <Register />}
        />
        <Route path="/" element={<Home />} />
        <Route path="/profile/:username" element={<Profile />} />

        {/* Protected routes that require authentication */}
        <Route
          path="/messages"
          element={
            isAuthenticated ? <Messages /> : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/settings"
          element={
            isAuthenticated ? <Settings /> : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/notifications"
          element={
            isAuthenticated ? (
              <Notifications />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/sessions"
          element={
            isAuthenticated ? <Sessions /> : <Navigate to="/login" replace />
          }
        />

        {/* Redirect to home page instead of forcing login */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default AppRoutes;
