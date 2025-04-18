import React, { useState } from "react";
import AppRoutes from "./routes/AppRoutes";
import Footer from "./components/Layout/Footer/Footer.js";

const App = () => {
  // eslint-disable-next-line
  const [accessToken, setAccessToken] = useState("");

  return (
    <>
      <AppRoutes setAccessToken={setAccessToken} />
      <Footer />
    </>
  );
};

export default App;
