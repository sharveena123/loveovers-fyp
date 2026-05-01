import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const DARK_MODE_KEY = "app.darkMode";

export const lightColors = {
  primary: "#6a3c00ff",
  primarySoft: "#fff7efff",
  success: "#8F9779ff",
  successSoft: "#e7f1e5ff",
  error: "#dc2626",
  errorSoft: "#fee2e2",
  backgroundSoft: "#e7f1e5ff",
  background: "#fff7efff",
  text: "#000",
  textSoft: "#666",
  border: "#e5e5e5",
  buttonText: "#fff",
  white: "#fff",
};

export const darkColors = {
  primary: "#d4a574ff",
  primarySoft: "#3d2817ff",
  success: "#a8bf96ff",
  successSoft: "#2a3a22ff",
  error: "#ff6b6b",
  errorSoft: "#4d1f1f",
  backgroundSoft: "#2a2a2a",
  background: "#1a1a1a",
  text: "#f0f0f0",
  textSoft: "#b0b0b0",
  border: "#404040",
  buttonText: "#fff",
  white: "#1a1a1a",
};

interface ThemeContextType {
  isDarkMode: boolean;
  setIsDarkMode: (value: boolean) => void;
  colors: typeof lightColors;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [isDarkMode, setIsDarkModeState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load dark mode preference from storage
    const loadDarkMode = async () => {
      try {
        const stored = await AsyncStorage.getItem(DARK_MODE_KEY);
        if (stored !== null) {
          setIsDarkModeState(stored === "true");
        }
      } catch (error) {
        console.error("Error loading dark mode preference:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDarkMode();
  }, []);

  const setIsDarkMode = async (value: boolean) => {
    setIsDarkModeState(value);
    try {
      await AsyncStorage.setItem(DARK_MODE_KEY, value.toString());
    } catch (error) {
      console.error("Error saving dark mode preference:", error);
    }
  };

  const colors = isDarkMode ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ isDarkMode, setIsDarkMode, colors }}>
      {!isLoading && children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
