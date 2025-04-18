import React, { useState, useEffect } from "react";
import axiosInstance from "../../../services/api";
import { AVAILABLE_TOPICS } from "../../../utils/topics";
import { getFallbackAvatar } from "../../../utils/avatar";
import "../../Common/Buttons/Buttons.css";
import "./EditProfile.css";

/**
 * Edit Profile Form
 *
 * Provides interface for users to update their profile with the following features:
 * - Profile picture upload, preview, and removal
 * - Adding and editing bio
 * - Adding a role (students can add tutor role and vice versa)
 * - Role-specific fields for tutors (hourly rate, lesson description)
 * - Setting preferred mode of teaching (in-person, webcam)
 * - Topic management for tutors (adding/removing topics)
 */
const EditProfile = ({
  profile,
  onSaveChanges,
  onCancelEdit,
  onToast,
  MAX_BIO_LENGTH = 500,
  MAX_LESSON_DESCRIPTION_LENGTH = 1000,
}) => {
  const [editData, setEditData] = useState({});
  const [profilePicture, setProfilePicture] = useState(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState("");
  const [additionalRole, setAdditionalRole] = useState("");
  const [charCount, setCharCount] = useState({
    bio: 0,
    lesson_description: 0,
  });
  const [isSaving, setIsSaving] = useState(false);

  // Initialize when the component mounts
  useEffect(() => {
    if (profile) {
      setEditData(profile || {});
      setCharCount({
        bio: profile?.bio?.length || 0,
        lesson_description: profile?.lesson_description?.length || 0,
      });

      // Reset profile picture state when form is opened
      setProfilePicture(null);
    }
  }, [profile]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === "bio" || name === "lesson_description") {
      setCharCount((prev) => ({ ...prev, [name]: value.length }));
    }
    setEditData((prev) => ({ ...prev, [name]: value }));
  };

  const handleProfilePictureChange = (e) => {
    // Get the first selected file
    const file = e.target.files[0];
    if (file && file.size > 5 * 1024 * 1024) {
      onToast("Profile picture must be less than 5MB", "error");
      return;
    }
    setProfilePicture(file);
  };

  const handleRemoveProfilePicture = async () => {
    if (
      !window.confirm("Are you sure you want to remove your profile picture?")
    ) {
      return;
    }

    setIsRemoving(true);
    try {
      const formData = new FormData();
      formData.append("remove_profile_picture", "true");

      await axiosInstance.put(`/profile/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Update local state only, without triggering parent component updates
      setEditData((prev) => ({
        ...prev,
        profile_picture: null,
      }));
      setProfilePicture(null);

      // Update the parent display of the profile picture without closing the form
      const pictureRemovedEvent = new CustomEvent("profilePictureRemoved");
      document.dispatchEvent(pictureRemovedEvent);

      onToast("Profile picture removed successfully", "success");
    } catch (error) {
      console.error("Error removing profile picture:", error);
      onToast("Failed to remove profile picture", "error");
    } finally {
      setIsRemoving(false);
    }
  };

  const handleAddRole = async () => {
    if (!additionalRole) {
      return;
    }

    try {
      const updatedRoles = [...(editData.roles || [])];
      if (!updatedRoles.includes(additionalRole)) {
        updatedRoles.push(additionalRole);
      }

      setEditData((prev) => ({
        ...prev,
        roles: updatedRoles,
        hourly_rate:
          additionalRole === "Tutor"
            ? prev.hourly_rate || ""
            : prev.hourly_rate,
        preferred_mode:
          additionalRole === "Tutor"
            ? prev.preferred_mode || "both"
            : prev.preferred_mode,
        topics: additionalRole === "Tutor" ? prev.topics || [] : prev.topics,
      }));

      setAdditionalRole("");

      onToast(`${additionalRole} role added successfully`, "success");
    } catch (error) {
      console.error("Error adding role:", error);
      onToast("Failed to add role", "error");
    }
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      // Map user-friendly display values to database values
      const getValidPreferredMode = (mode) => {
        const modeMap = {
          webcam: "webcam",
          Webcam: "webcam",
          "in-person": "in-person",
          "In-Person": "in-person",
          both: "both",
          Both: "both",
        };
        return modeMap[mode] || "both";
      };

      // Build the data object
      const dataToSend = {
        username: editData.username || profile.username,
        email: editData.email || profile.email,
        first_name: editData.first_name || profile.first_name || "",
        last_name: editData.last_name || profile.last_name || "",
        bio: editData.bio || "",
        preferred_mode: getValidPreferredMode(
          editData.preferred_mode || profile.preferred_mode || "both",
        ),
        location: editData.location || profile.location || "",
        lesson_description: editData.lesson_description || "",
        hourly_rate: editData.hourly_rate || "",
      };

      const formData = new FormData();

      // Add each field
      Object.keys(dataToSend).forEach((key) => {
        if (dataToSend[key] != null) {
          formData.append(key, dataToSend[key]);
        }
      });

      if (profilePicture) {
        formData.append("profile_picture", profilePicture);
      }

      await axiosInstance.put("/profile/", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const originalRoles = Array.isArray(profile.roles)
        ? profile.roles
            .map((role) => (typeof role === "string" ? role : role.name))
            .filter(Boolean)
        : [];

      const editedRoles = Array.isArray(editData.roles) ? editData.roles : [];
      const rolesChanged =
        JSON.stringify(originalRoles.sort()) !==
        JSON.stringify(editedRoles.sort());

      if (rolesChanged) {
        try {
          await axiosInstance.put("/update-role/", {
            roles: editedRoles,
          });
        } catch (roleError) {
          console.error("Error in explicit role update:", roleError);
        }
      }

      if (editData.roles && editData.roles.includes("Tutor")) {
        const profileResponse = await axiosInstance.get(
          `/profile/${profile.username}/`,
        );
        const currentServerTopics = profileResponse.data.topics || [];

        const editedTopics = editData.topics || [];

        // Find topics to remove
        const topicsToRemove = currentServerTopics.filter(
          (topic) => !editedTopics.includes(topic),
        );

        for (const topic of topicsToRemove) {
          try {
            const topicResponse = await axiosInstance.get(
              `/topics/?name=${encodeURIComponent(topic)}`,
            );

            if (topicResponse.data && topicResponse.data.length > 0) {
              const topicId = topicResponse.data[0].id;

              try {
                await axiosInstance.delete(`/tutor-topics/remove_by_name/`, {
                  data: { topic_name: topic },
                });
                console.log(
                  `Successfully removed topic ${topic} using direct method`,
                );
              } catch (directError) {
                console.log(
                  "Direct removal failed, trying fallback method:",
                  directError,
                );

                const tutorTopicsResponse =
                  await axiosInstance.get(`/tutor-topics/`);

                const tutorTopics =
                  tutorTopicsResponse.data.results || tutorTopicsResponse.data;

                // Convert IDs to strings for comparison to avoid type issues
                const userIdStr = String(profile.id);
                const topicIdStr = String(topicId);

                console.log(
                  "Looking for tutor topic with user:",
                  userIdStr,
                  "and topic:",
                  topicIdStr,
                );
                console.log("Available tutor topics:", tutorTopics);

                let tutorTopicToRemove = null;
                for (const tt of tutorTopics) {
                  if (
                    String(tt.tutor) === userIdStr &&
                    String(tt.topic) === topicIdStr
                  ) {
                    tutorTopicToRemove = tt;
                    console.log("Found matching tutor topic:", tt);
                    break;
                  }
                }

                if (tutorTopicToRemove) {
                  console.log(
                    "Deleting tutor topic with ID:",
                    tutorTopicToRemove.id,
                  );
                  await axiosInstance.delete(
                    `/tutor-topics/${tutorTopicToRemove.id}/`,
                  );
                } else {
                  console.warn(
                    `No TutorTopic relation found for user:${userIdStr} and topic:${topicIdStr}`,
                  );
                }
              }
            }
          } catch (err) {
            console.error(`Error removing topic ${topic}:`, err);
          }
        }
      }

      // Fetch the updated profile
      const updatedProfileResponse = await axiosInstance.get("/profile/");
      onSaveChanges(updatedProfileResponse.data);
      onToast("Profile updated successfully", "success");
    } catch (error) {
      console.error("Error updating profile:", error);
      onToast(
        error.response?.data?.detail || "Failed to update profile",
        "error",
      );
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Adds a new topic to tutor's profile
   *
   * @param {string} newTopic - Topic to add
   * @returns {boolean} True if successful, false otherwise
   */
  const handleAddTopic = async (newTopic) => {
    if (!newTopic.trim()) {
      onToast("Topic cannot be empty", "error");
      return false;
    }

    // Check for duplicate topics
    const currentTopics = editData.topics || [];
    if (
      currentTopics.some(
        (topic) => topic.toLowerCase() === newTopic.trim().toLowerCase(),
      )
    ) {
      onToast("This topic already exists", "error");
      return false;
    }

    try {
      const profileResponse = await axiosInstance.get("/profile/");
      const currentUserProfile = profileResponse.data;

      // Create the topic
      const topicResponse = await axiosInstance.post("/topics/", {
        name: newTopic.trim(),
        description: "",
      });
      const topicId = topicResponse.data.id;

      // Create the TutorTopic
      await axiosInstance.post("/tutor-topics/", {
        topic: topicId,
        tutor: currentUserProfile.id,
      });

      // Update profile topics
      const updatedTopics = [...currentTopics, newTopic.trim()];
      setEditData((prev) => ({ ...prev, topics: updatedTopics }));

      onToast("Topic added successfully", "success");
      return true;
    } catch (error) {
      console.error("Full error details:", {
        errorResponse: error.response,
        errorData: error.response?.data,
        errorStatus: error.response?.status,
      });

      onToast(
        error.response?.data?.detail ||
          (typeof error.response?.data === "object"
            ? JSON.stringify(error.response.data)
            : "Failed to add topic. Please try again."),
        "error",
      );
      return false;
    }
  };

  /**
   * Removes a topic from tutor's profile
   *
   * @param {string} topicToRemove - Topic to remove
   */
  const handleRemoveTopic = async (topicToRemove) => {
    try {
      const updatedTopics = (editData.topics || []).filter(
        (topic) => topic !== topicToRemove,
      );
      setEditData((prev) => ({ ...prev, topics: updatedTopics }));
      onToast("Topic removed from profile", "success");
    } catch (error) {
      console.error("Error in topic removal:", error);
      onToast("Error removing topic", "error");
    }
  };

  const onAddTopic = async () => {
    if (selectedTopic) {
      const success = await handleAddTopic(selectedTopic);
      if (success) {
        setSelectedTopic("");
      }
    }
  };

  // Get current roles and missing roles
  const currentRoles = Array.isArray(profile.roles)
    ? profile.roles
        .map((role) => (typeof role === "string" ? role : role.name))
        .filter(Boolean)
    : [];

  // Get the current roles being edited
  const editedRoles = Array.isArray(editData.roles)
    ? editData.roles
    : [...currentRoles];

  // Find missing roles based on editedRoles
  const missingRoles = ["Student", "Tutor"].filter(
    (role) => !editedRoles.includes(role),
  );

  // Check if user has Tutor role or is adding it
  const isTutorOrAddingTutor = editedRoles.includes("Tutor");

  return (
    <div className="popout-form edit-profile-form">
      <h3>Edit Profile</h3>

      <div className="edit-profile-form-container">
        <div className="form-field">
          <label>Profile Picture:</label>
          <div className="profile-controls-wrapper">
            <div className="file-input-container">
              <div className="file-controls">
                <label
                  className="button button--primary"
                  htmlFor="profile-picture"
                >
                  Choose File
                </label>
                <input
                  id="profile-picture"
                  name="profilePicture"
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePictureChange}
                />
              </div>

              {/* Image preview */}
              {(profilePicture || profile.profile_picture) && (
                <div className="profile-image-preview">
                  <img
                    src={
                      profilePicture
                        ? URL.createObjectURL(profilePicture)
                        : profile.profile_picture
                          ? profile.profile_picture.startsWith("http")
                            ? profile.profile_picture
                            : `${process.env.REACT_APP_API_URL}${profile.profile_picture}`
                          : getFallbackAvatar(profile.username)
                    }
                    alt="Profile Preview"
                  />
                </div>
              )}

              {profile.profile_picture && (
                <button
                  type="button"
                  className="button button--danger"
                  onClick={handleRemoveProfilePicture}
                  disabled={isRemoving}
                >
                  {isRemoving ? "Removing..." : "Remove"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Add a Role Section - Show for either Students or Tutors */}
        {missingRoles.length > 0 && (
          <div className="role-section">
            <label>Add Role:</label>
            <div className="role-controls">
              <select
                className="role-select"
                value={additionalRole}
                onChange={(e) => setAdditionalRole(e.target.value)}
              >
                <option value="">Select a Role</option>
                {missingRoles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="button button--primary add-role-btn"
                onClick={handleAddRole}
                disabled={!additionalRole}
              >
                Add Role
              </button>
            </div>
          </div>
        )}

        {/* Tutor Specific Section - Show for both existing tutors and students adding tutor role */}
        {isTutorOrAddingTutor && (
          <>
            {/* Hourly Rate Section */}
            <div className="rate-section">
              <label>Hourly Rate:</label>
              <input
                type="number"
                name="hourly_rate"
                min="0"
                value={editData.hourly_rate || ""}
                onChange={handleInputChange}
                placeholder="0.00"
              />
            </div>

            {/* Preferred Mode Section */}
            <div className="form-field">
              <label>Preferred Mode:</label>
              <select
                className="topic-select"
                name="preferred_mode"
                value={
                  editData.preferred_mode || profile.preferred_mode || "both"
                }
                onChange={handleInputChange}
              >
                <option value="">Choose a preferred mode</option>
                <option value="webcam">Webcam</option>
                <option value="in-person">In-Person</option>
                <option value="both">Both</option>
              </select>
            </div>

            {/* Topic Management Section */}
            <div className="topics-section">
              <label>Topic(s):</label>
              <div className="topic-controls">
                <select
                  className="topic-select"
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  required
                >
                  <option value="">Select a Topic</option>
                  {AVAILABLE_TOPICS.filter(
                    (topic) => !(editData.topics || []).includes(topic),
                  ).map((topic) => (
                    <option key={topic} value={topic}>
                      {topic}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="button button--primary"
                  onClick={onAddTopic}
                  disabled={!selectedTopic}
                >
                  Add Topic
                </button>
              </div>

              <div className="topics-list">
                {(editData.topics || []).map((topic) => (
                  <div key={topic} className="topic-chip">
                    {topic}
                    <button
                      type="button"
                      className="remove-topic-btn"
                      onClick={() => handleRemoveTopic(topic)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Lesson Description Section */}
            <div className="form-field">
              <label>Lesson Description:</label>
              <div className="input-wrapper">
                <textarea
                  name="lesson_description"
                  value={editData.lesson_description || ""}
                  onChange={handleInputChange}
                  placeholder="Describe what people can expect from your lessons..."
                  maxLength={MAX_LESSON_DESCRIPTION_LENGTH}
                  className="text-input"
                />
                <div className="char-counter">
                  {charCount.lesson_description}/{MAX_LESSON_DESCRIPTION_LENGTH}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Bio Section */}
        <div className="form-field">
          <label>Bio:</label>
          <div className="input-wrapper">
            <textarea
              name="bio"
              value={editData.bio || ""}
              onChange={handleInputChange}
              placeholder="Tell us about yourself..."
              maxLength={MAX_BIO_LENGTH}
              className="text-input"
            />
            <div className="char-counter">
              {charCount.bio}/{MAX_BIO_LENGTH}
            </div>
          </div>
        </div>

        {/* Form Action Buttons */}
        <div className="button-container">
          <button
            className="button button--primary"
            onClick={handleSaveChanges}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
          <button
            className="button button--close"
            onClick={onCancelEdit}
            disabled={isSaving}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditProfile;
