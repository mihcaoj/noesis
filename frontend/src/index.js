import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/index.css";
import App from "./App";

// Error handler for bootstrap autofill overlay
window.addEventListener("error", (event) => {
  if (
    event.message.includes("NotFoundError: The object can not be found here")
  ) {
    event.preventDefault();
    console.warn("Suppressed bootstrap autofill overlay error");
  }
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
