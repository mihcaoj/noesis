import React, { useState, useEffect } from "react";
import axiosInstance from "../../services/api";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Layout/NavBar/NavBar";
import ToastNotifications from "../../components/Common/ToastNotifications/ToastNotifications";
import { useToast } from "../../utils/hooks";
import "../../components/Common/Buttons/Buttons.css";
import "./Settings.css";

/**
 * Settings Page
 *
 * Provides the following user account management functionalities:
 * - Updating an email address
 * - Changing a password
 * - Deleting an account
 */
const Settings = () => {
  const [userData, setUserData] = useState(null);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { toastMessage, toastType, showToast, clearToast } = useToast();
  const navigate = useNavigate();

  // Fetch user data on component mount
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await axiosInstance.get("/profile/");
        setUserData(response.data);
        setNewEmail(response.data.email);
      } catch (error) {
        console.error("Failed to fetch user data:", error);
      }
    };

    fetchUserData();
  }, []);

  // Handles the email update process
  const handleUpdateEmail = async () => {
    // Check that emails match
    if (newEmail !== confirmEmail) {
      showToast("Email addresses do not match", "error");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("email", newEmail);

      await axiosInstance.put("/profile/", formData, {
        headers: {
          "Content-Type": undefined,
        },
      });

      showToast("Email updated successfully", "success");
      setIsEditingEmail(false);
      setUserData((prev) => ({ ...prev, email: newEmail }));
    } catch (error) {
      const errorMessage =
        error.response?.data?.email?.[0] ||
        error.response?.data?.detail ||
        "Failed to update email";
      showToast(errorMessage, "error");
    }
  };

  //Handles the password change process
  const handleChangePassword = async () => {
    // Validate passwords
    if (newPassword !== confirmPassword) {
      showToast("New passwords do not match", "error");
      return;
    }

    if (newPassword.length < 8) {
      showToast("Password must be at least 8 characters", "error");
      return;
    }

    try {
      await axiosInstance.post("/change-password/", {
        current_password: currentPassword,
        new_password: newPassword,
      });

      showToast("Password updated successfully", "success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setIsChangingPassword(false);
    } catch (error) {
      const errorMessage =
        error.response?.data?.detail |
          error.response?.data?.current_password?.[0] ||
        error.response?.data?.new_password?.[0] ||
        "Failed to change password";
      showToast(errorMessage, "error");
    }
  };

  /**
   * Handles the account deletion processs by sending a DELETE request to remove the user's profile
   * If successful, clears local storage and redirects to the login page
   */
  const handleDeleteAccount = async () => {
    try {
      await axiosInstance.delete("/profile/");
      showToast("Account successfully deleted. Redirecting...", "success");

      // Delay cleanup to allow the user to see the success message
      setTimeout(() => {
        localStorage.clear();
        navigate("/login");
      }, 2000);
    } catch (error) {
      const errorMessage =
        error.response?.data?.detail ||
        "Failed to delete account. Please try again.";
      showToast(errorMessage, "error");
      setConfirmDelete(false);
    }
  };

  return (
    <div className="page-container">
      <Navbar />

      {toastMessage && (
        <ToastNotifications
          message={toastMessage}
          type={toastType}
          onClose={clearToast}
        />
      )}

      <header className="page-header">
        <h2>Settings</h2>
      </header>

      <div className="content-container">
        {userData && (
          <div className="settings-container">
            {/* Email Settings */}
            <div className="settings-section">
              <h3>Change Email</h3>
              <div className="settings-content">
                {!isEditingEmail ? (
                  <div className="current-value">
                    <p>
                      <strong>Current Email:</strong>{" "}
                      <span>{userData.email}</span>
                    </p>
                    <button
                      className="button button--primary"
                      onClick={() => setIsEditingEmail(true)}
                    >
                      Change Email
                    </button>
                  </div>
                ) : (
                  <div className="settings-form">
                    <div className="form-group">
                      <label htmlFor="newEmail">New Email:</label>
                      <input
                        id="newEmail"
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="Enter new email"
                      />
                      <label htmlFor="confirmEmail">Confirm New Email:</label>
                      <input
                        id="confirmEmail"
                        type="email"
                        value={confirmEmail}
                        onChange={(e) => setConfirmEmail(e.target.value)}
                        placeholder="Confirm new email"
                      />
                    </div>
                    <div className="confirm-cancel-container">
                      <button
                        className="button button--primary"
                        onClick={handleUpdateEmail}
                      >
                        Update Email
                      </button>
                      <button
                        className="button button--close"
                        onClick={() => {
                          setIsEditingEmail(false);
                          setNewEmail(userData.email);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Password Settings */}
            <div className="settings-section">
              <h3>Change Password</h3>
              <div className="settings-content">
                {!isChangingPassword ? (
                  <div className="current-value">
                    <button
                      className="button button--primary"
                      onClick={() => setIsChangingPassword(true)}
                    >
                      Change Password
                    </button>
                  </div>
                ) : (
                  <div className="settings-form">
                    <div className="form-group">
                      <label htmlFor="currentPassword">Current Password:</label>
                      <input
                        id="currentPassword"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="newPassword">New Password:</label>
                      <input
                        id="newPassword"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="confirmPassword">
                        Confirm New Password:
                      </label>
                      <input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                      />
                    </div>
                    <div className="confirm-cancel-container">
                      <button
                        className="button button--primary"
                        onClick={handleChangePassword}
                      >
                        Update Password
                      </button>
                      <button
                        className="button button--close"
                        onClick={() => {
                          setIsChangingPassword(false);
                          setCurrentPassword("");
                          setNewPassword("");
                          setConfirmPassword("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Account Deletion */}
            <div className="settings-section danger-zone">
              <h3>Delete Account</h3>
              <div className="settings-content">
                <p>Deleting your account is permanent and cannot be undone.</p>
                {!confirmDelete ? (
                  <button
                    className="button button--danger"
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete My Account
                  </button>
                ) : (
                  <div className="confirm-delete">
                    <p>Are you sure?</p>
                    <div className="confirm-cancel-container">
                      <button
                        className="button button--close"
                        onClick={handleDeleteAccount}
                      >
                        Yes, Delete
                      </button>
                      <button
                        className="button button--primary"
                        onClick={() => setConfirmDelete(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
