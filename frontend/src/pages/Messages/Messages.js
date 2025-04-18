import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axiosInstance from "../../services/api";
import Navbar from "../../components/Layout/NavBar/NavBar";
import ToastNotifications from "../../components/Common/ToastNotifications/ToastNotifications";
import { useToast } from "../../utils/hooks";
import { getFallbackAvatar } from "../../utils/avatar";
import "./Messages.css";

/**
 * Messages Page
 *
 * Provides messaging functionality with the following features:
 * - Viewing conversation list with unread indicators
 * - Reading and sending messages
 * - Tracking message read status
 * - Navigating to user profiles
 */
const Messages = () => {
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const { toastMessage, toastType, showToast, clearToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const initialReceiverId = queryParams.get("receiver");
  const messagesEndRef = useRef(null);

  /**
   * Custom hook for dynamic polling of new messages
   *
   * @param {Object} selectedUser - Currently selected conversation user
   * @param {Array} messages - Current messages in the conversation
   * @returns {number} Current polling interval in milliseconds
   */
  const useDynamicPolling = (selectedUser, messages) => {
    const [pollingInterval, setPollingInterval] = useState(5000);

    useEffect(() => {
      let timer;

      const fetchNewMessages = async () => {
        if (!selectedUser) return;

        try {
          // Only get messages newer than the most recent one we have
          const latestTimestamp =
            messages.length > 0
              ? messages[messages.length - 1].timestamp
              : null;

          const params = new URLSearchParams();
          params.append("receiver", selectedUser.id);
          if (latestTimestamp) {
            params.append("since", latestTimestamp);
          }

          const response = await axiosInstance.get(`/messages/?${params}`);
          const newMessages = response.data.results || [];

          if (newMessages.length > 0) {
            // If we got new messages, check more frequently
            setPollingInterval(Math.max(1000, pollingInterval - 1000));

            // Add new messages and ensure order
            setMessages((prev) => {
              // Filter out duplicates
              const uniqueNewMessages = newMessages.filter(
                (newMsg) =>
                  !prev.some((existingMsg) => existingMsg.id === newMsg.id),
              );

              if (uniqueNewMessages.length === 0) return prev;

              // Create a new array with all messages and sort by timestamp
              const combinedMessages = [...prev, ...uniqueNewMessages];
              combinedMessages.sort(
                (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
              );

              return combinedMessages;
            });

            // If we received messages from the current conversation partner
            const hasNewMessagesFromPartner = newMessages.some(
              (msg) => msg.sender === selectedUser.id,
            );
            if (hasNewMessagesFromPartner) {
              markMessagesAsRead(selectedUser.id);
            }
          } else {
            // If no new messages, gradually slow down polling
            setPollingInterval(Math.min(10000, pollingInterval + 500));
          }
        } catch (error) {
          console.error("Error fetching new messages:", error);
        }

        // Schedule next poll
        timer = setTimeout(fetchNewMessages, pollingInterval);
      };

      fetchNewMessages();

      return () => clearTimeout(timer);
    }, [selectedUser, pollingInterval, messages]);

    return pollingInterval;
  };

  useDynamicPolling(selectedUser, messages);

  /**
   * Fetches messages for a specific user with pagination support
   *
   * @param {string} userId - ID of the user to fetch messages with
   */
  const fetchMessages = useCallback(
    async (userId) => {
      try {
        const response = await axiosInstance.get(
          `/messages/?receiver=${userId}`,
        );
        let allMessages = response.data.results || [];
        let nextPage = response.data.next;
        while (nextPage) {
          const nextResponse = await axiosInstance.get(nextPage);
          allMessages = [...allMessages, ...(nextResponse.data.results || [])];
          nextPage = nextResponse.data.next;
        }

        // Sort by timestamp
        allMessages.sort(
          (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
        );

        setMessages(allMessages);
      } catch (error) {
        showToast("Failed to load messages. Please try again.", "error");
      }
    },
    [showToast],
  );

  // Marks all messages from a sender as read
  const markMessagesAsRead = useCallback(
    async (senderId) => {
      try {
        await axiosInstance.post("/messages/mark-read/", {
          sender_id: senderId,
        });

        updateGlobalUnreadMessages();
      } catch (error) {
        showToast("Failed to mark messages as read", "error");
      }
    },
    [showToast],
  );

  // Updates the global unread messages count
  const updateGlobalUnreadMessages = async () => {
    try {
      await axiosInstance.get("/messages/unread-count");
    } catch (error) {
      console.error("Failed to update global unread messages count:", error);
    }
  };

  // Fetches all conversations for the current user
  const fetchConversations = useCallback(async () => {
    try {
      const response = await axiosInstance.get("/messages/conversations/");
      setConversations(response.data.results || []);
    } catch (error) {
      showToast(
        "Failed to load conversations. Please refresh the page.",
        "error",
      );
    }
  }, [showToast]);

  // Fetches user details and their messages
  const fetchUserAndMessages = useCallback(
    async (userId) => {
      try {
        const userResponse = await axiosInstance.get(`/users/${userId}/`);
        setSelectedUser(userResponse.data);
        fetchMessages(userId);
        markMessagesAsRead(userId);
      } catch (error) {
        showToast("Failed to load user information", "error");
      }
    },
    [fetchMessages, markMessagesAsRead, showToast],
  );

  useEffect(() => {
    fetchConversations();

    if (initialReceiverId) {
      fetchUserAndMessages(initialReceiverId);
    }
  }, [initialReceiverId, fetchUserAndMessages, fetchConversations]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser) return;

    try {
      const response = await axiosInstance.post("/messages/", {
        message: newMessage,
        receiver: selectedUser.id,
      });

      setNewMessage("");

      if (response.data && response.data.id) {
        setMessages((prevMessages) => {
          const updatedMessages = [...prevMessages, response.data];
          updatedMessages.sort(
            (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
          );
          return updatedMessages;
        });
      } else {
        fetchMessages(selectedUser.id);
      }

      fetchConversations();
    } catch (error) {
      showToast("Failed to send message. Please try again.", "error");
    }
  };

  // Selects a conversation and fetches its messages
  const selectConversation = (user) => {
    setSelectedUser(user);
    fetchMessages(user.id);
    markMessagesAsRead(user.id);
    navigate(`/messages?receiver=${user.id}`, { replace: true });
  };

  // Gets the URL for a profile picture or fallback
  const getProfilePictureUrl = (profilePicture, username) => {
    if (!profilePicture) {
      return getFallbackAvatar(username);
    }
    return `${process.env.REACT_APP_API_URL}${profilePicture}`;
  };

  const navigateToProfile = (username) => {
    navigate(`/profile/${username}`);
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
        <h2>Messages</h2>
      </header>

      <div className="message-dashboard">
        <div className="conversations-list">
          <h2>Conversations</h2>
          {conversations.length > 0 ? (
            conversations.map((conv) => (
              <div
                key={conv.user.id}
                className={`conversation-item ${selectedUser?.id === conv.user.id ? "active" : ""}`}
                onClick={() => selectConversation(conv.user)}
              >
                <img
                  src={getProfilePictureUrl(
                    conv.user.profile_picture,
                    conv.user.username,
                  )}
                  alt={`${conv.user.username}'s avatar`}
                  className="conversation-avatar"
                />
                <div className="conversation-info">
                  <h3>{conv.user.username}</h3>
                  <p>{conv.last_message?.message || "No messages yet"}</p>
                </div>
                {conv.unread_count > 0 && (
                  <span className="unread-stuff unread-count">
                    {conv.unread_count}
                  </span>
                )}
              </div>
            ))
          ) : (
            <div className="no-conversations">
              <p>No conversations found.</p>
            </div>
          )}
        </div>

        <div className="chat-container">
          {selectedUser ? (
            <>
              <div className="chat-header">
                <img
                  src={
                    selectedUser.profile_picture ||
                    getFallbackAvatar(selectedUser.username)
                  }
                  alt={`${selectedUser.username}'s avatar`}
                  className="chat-header-avatar"
                />
                <h3
                  onClick={() => navigateToProfile(selectedUser.username)}
                  className="clickable-username"
                >
                  {selectedUser.username}
                </h3>
              </div>
              <div className="messages-list">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`message-item ${msg.sender === selectedUser.id ? "received" : "sent"}`}
                  >
                    <p className="message-content">{msg.message}</p>
                    <div className="message-time-container">
                      <span className="message-time">
                        {new Date(msg.timestamp).toLocaleString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })}
                      </span>
                      {msg.sender !== selectedUser.id && (
                        <div
                          className={`read-indicator ${msg.is_read ? "read" : "unread"}`}
                        />
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <div className="message-input-box">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }}
                />
                <button onClick={handleSendMessage}>Send</button>
              </div>
            </>
          ) : (
            <div className="no-chat-selected">
              <p>Select a conversation to start messaging.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Messages;
