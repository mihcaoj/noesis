import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../../services/api";
import Navbar from "../../../components/Layout/NavBar/NavBar";
import ToastNotifications from "../../../components/Common/ToastNotifications/ToastNotifications";
import { useToast } from "../../../utils/hooks";
import { AVAILABLE_TOPICS } from "../../../utils/topics";
import "../../../components/Common/Buttons/Buttons.css";
import "./Register.css";

/**
 * Register Page
 *
 * Handles user registration with the following features:
 * - Collecting user information (username, email, password)
 * - Selecting user role (Student/Tutor)
 * - Adding tutor-specific information (topics, hourly rate)
 * - Validating form inputs
 */
const Register = () => {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    roles: ["Student"],
    hourly_rate: "",
  });
  const [selectedTopics, setSelectedTopics] = useState([]);
  const { toastMessage, toastType, showToast, clearToast } = useToast();
  const navigate = useNavigate();

  /**
   * Validates the form data before submission
   *
   * @returns {boolean} Whether the form is valid
   */
  const validateForm = () => {
    if (formData.password.length < 8) {
      showToast("Password must be at least 8 characters long", "error");
      return false;
    }

    if (!formData.email.includes("@")) {
      showToast("Please enter a valid email address", "error");
      return false;
    }

    if (
      formData.roles[0] === "Tutor" &&
      (parseFloat(formData.hourly_rate) <= 0 ||
        isNaN(parseFloat(formData.hourly_rate)))
    ) {
      showToast("Hourly rate must be a positive number", "error");
      return false;
    }

    // Check if tutor role is selected but no topics
    if (formData.roles[0] === "Tutor" && selectedTopics.length === 0) {
      showToast("Tutors must select at least one topic", "error");
      return false;
    }

    // Check if tutor role is selected but no hourly rate
    if (formData.roles[0] === "Tutor" && !formData.hourly_rate) {
      showToast("Tutors must set an hourly rate", "error");
      return false;
    }

    return true;
  };

  /**
   * Handles input changes and updates form state
   *
   * @param {Object} e - Event object from input field
   */
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === "role") {
      setFormData({
        ...formData,
        roles: [value.charAt(0).toUpperCase() + value.slice(1)],
      });
    } else if (name === "topic") {
      if (value && !selectedTopics.includes(value)) {
        setSelectedTopics([...selectedTopics, value]);
      }
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleRemoveTopic = (topicToRemove) => {
    setSelectedTopics(
      selectedTopics.filter((topic) => topic !== topicToRemove),
    );
  };

  /**
   * Handles form submission by sending a POST request to the backend
   *
   * @param {Object} e - Event object from form submission
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    clearToast();

    if (!validateForm()) {
      return;
    }

    try {
      const registerData = { ...formData };

      // Add topics if user is a tutor
      if (formData.roles[0] === "Tutor") {
        registerData.topics = selectedTopics;
        // Convert hourly_rate to a number
        registerData.hourly_rate = parseFloat(formData.hourly_rate);
      } else {
        // Remove hourly_rate for students
        delete registerData.hourly_rate;
      }

      await axiosInstance.post("/register/", registerData);
      showToast("Registration successful. Redirecting to login...", "success");

      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (err) {
      if (err.response?.data) {
        const errorData = err.response.data;
        if (errorData.username) {
          showToast(`Username error: ${errorData.username[0]}`, "error");
        } else if (errorData.email) {
          showToast(`Email error: ${errorData.email[0]}`, "error");
        } else if (errorData.password) {
          showToast(`Password error: ${errorData.password[0]}`, "error");
        } else if (errorData.topics) {
          showToast(`Topics error: ${errorData.topics[0]}`, "error");
        } else if (errorData.hourly_rate) {
          showToast(`Hourly rate error: ${errorData.hourly_rate[0]}`, "error");
        } else if (errorData.detail) {
          showToast(errorData.detail, "error");
        } else {
          showToast(
            "Registration failed. Please check your information and try again.",
            "error",
          );
        }
      } else {
        showToast(
          "Registration failed. Please check your connection and try again.",
          "error",
        );
      }
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
        <h2>Register</h2>
      </header>
      <form className="form" onSubmit={handleSubmit}>
        <div>
          <label>Username:</label>
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleInputChange}
            required
            minLength={3}
          />
        </div>
        <div>
          <label>Email:</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            required
          />
        </div>
        <div>
          <label>Password:</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            required
            minLength={8}
          />
        </div>
        <div>
          <label>First Name:</label>
          <input
            type="text"
            name="first_name"
            value={formData.first_name}
            onChange={handleInputChange}
          />
        </div>
        <div>
          <label>Last Name:</label>
          <input
            type="text"
            name="last_name"
            value={formData.last_name}
            onChange={handleInputChange}
          />
        </div>
        <div>
          <label>Role:</label>
          <select
            name="role"
            value={formData.roles[0]?.toLowerCase() || ""}
            onChange={handleInputChange}
          >
            <option value="">Choose a Role</option>
            <option value="student">Student</option>
            <option value="tutor">Tutor</option>
          </select>
        </div>

        {/* Only show Tutor specific fields if Tutor role is selected */}
        {formData.roles[0] === "Tutor" && (
          <>
            <div>
              <label>Select Topic(s):</label>
              <div>
                <select name="topic" onChange={handleInputChange} value="">
                  <option value="">Select a Topic</option>
                  {AVAILABLE_TOPICS.filter(
                    (topic) => !selectedTopics.includes(topic),
                  ).map((topic) => (
                    <option key={topic} value={topic}>
                      {topic}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected topics */}
              {selectedTopics.length > 0 && (
                <div className="register-topic-list">
                  {selectedTopics.map((topic) => (
                    <div key={topic} className="register-topic-chip">
                      {topic}
                      <button
                        type="button"
                        className="register-remove-topic-btn"
                        onClick={() => handleRemoveTopic(topic)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="rate-section">
              <label>Hourly Rate (CHF):</label>
              <input
                type="number"
                name="hourly_rate"
                min="0"
                value={formData.hourly_rate}
                onChange={handleInputChange}
                placeholder="0.00"
                required
              />
            </div>
          </>
        )}

        <button
          type="submit"
          className="button button--primary register-button"
        >
          Register
        </button>
      </form>
    </div>
  );
};

export default Register;
