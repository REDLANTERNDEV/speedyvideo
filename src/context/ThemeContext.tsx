import React, { createContext, useContext, useEffect, useState } from "react";

interface ThemeContextType {
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    if (chrome?.storage?.local) {
      try {
        chrome.storage.local.get(["darkMode"], (result) => {
          if (!chrome.runtime?.lastError) {
            setDarkMode(!!result.darkMode);
          }
        });
      } catch (error) {
        // Silent error handling in production
      }
    }
    // else: skip storage access if not available
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }
    if (chrome?.storage?.local) {
      chrome.storage.local.set({ darkMode }).catch(() => {
        // Silent error handling in production
      });
    }
    // else: skip storage access if not available
  }, [darkMode]);

  const toggleTheme = () => setDarkMode((prev) => !prev);

  const contextValue = React.useMemo(
    () => ({ darkMode, setDarkMode, toggleTheme }),
    [darkMode, setDarkMode, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
};
