import React from "react";
import Popup from "./popup";
import { ThemeProvider } from "./context/ThemeContext";

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <Popup />
    </ThemeProvider>
  );
};

export default App;
