import { useEffect, useState, useRef } from "react";
import "./styles/speedSettings.css";
import { LogoSvg } from "./components/LogoSvg";
import { useTheme } from "./context/ThemeContext";

export default function SpeedSettings({ onClose }: { readonly onClose: () => void }) {
  const [speedList, setSpeedList] = useState<string[]>([]);
  const { darkMode } = useTheme();
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (chrome?.storage?.local) {
      chrome.storage.local.get(["defaultSpeedList"], (result) => {
        if (Array.isArray(result.defaultSpeedList)) {
          setSpeedList(
            result.defaultSpeedList.map((v: number) => v.toString())
          );
        }
      });
    }
    // else: skip storage access if not available
  }, []);
  
  // Save the current speedList to chrome.storage.local
  const handleSave = () => {
    // Convert strings to numbers, apply min/max limits
    const parsedList = speedList.map((v) => {
      let num = parseFloat(v);
      if (isNaN(num)) num = 0.1;
      if (num > 16) num = 16;
      if (num < 0.1) num = 0.1;
      return parseFloat(num.toFixed(2));
    });
    if (chrome?.storage?.local) {
      chrome.storage.local.set({ defaultSpeedList: parsedList }, () => {
        onClose();
      });
    } else {
      onClose();
    }
  };

  const updateSpeedValue = (index: number, value: string) => {
    const newList = [...speedList];
    newList[index] = value;
    setSpeedList(newList);
  };

  const addNewSpeed = () => {
    if (speedList.length < 9) {
      setSpeedList([...speedList, ""]);
      setTimeout(() => {
        const lastInput = inputRefs.current[speedList.length];
        lastInput?.focus();
      }, 0);
    }
  };

  const removeSpeed = (index: number) => {
    if (speedList.length > 1) {
      const newList = speedList.filter((_, i) => i !== index);
      setSpeedList(newList);
    }
  };

  return (
    <div className="speed-settings-body">
      <div className="speed-settings-header">
        <div className="speed-settings-logo">
          <LogoSvg fillColor={darkMode ? "#FFFFFF" : "#000000"} />
        </div>
      </div>      <div className="speed-settings-container">
        {speedList.map((speed, index) => (
          <div key={`speed-${index}-${speedList.length}`} className="speed-settings-row">
            <input
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              className="speed-settings-content"
              type="number"
              step="0.01"
              min="0.1"
              max="16"
              value={speed}
              onChange={(e) => updateSpeedValue(index, e.target.value)}
              placeholder="Enter speed (0.1-16)"
            />
            {speedList.length > 1 && (
              <button
                className="speed-settings-remove-button"
                onClick={() => removeSpeed(index)}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="speed-settings-buttons">
        <button className="speed-settings-save-button" onClick={handleSave}>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"
              fill={darkMode ? "#FFFFFF" : "#000000"}
            />
          </svg>
          Save
        </button>
        {speedList.length < 9 && (
          <button className="speed-settings-add-button" onClick={addNewSpeed}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"
                fill={darkMode ? "#FFFFFF" : "#000000"}
              />
            </svg>
            Add
          </button>
        )}
        <button className="speed-settings-cancel-button" onClick={onClose}>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
              fill={darkMode ? "#FFFFFF" : "#000000"}
            />
          </svg>
          Cancel
        </button>
      </div>
    </div>
  );
}
