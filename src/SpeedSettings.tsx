import { useEffect, useState, useRef } from "react";
import "./styles/speedSettings.css";
import { LogoSvg } from "./components/LogoSvg";
import { useTheme } from "./context/ThemeContext";

export default function SpeedSettings({
  onClose,
}: {
  readonly onClose: () => void;
}) {
  const [speedList, setSpeedList] = useState<string[]>([]);
  const { darkMode } = useTheme();
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  // Default speed list (same as in SpeedButtons.tsx)
  const defaultSpeedList = [0.5, 1.0, 1.1, 1.5, 2.0, 2.5, 3.0, 8.0, 16.0];
  useEffect(() => {
    if (chrome?.storage?.local) {
      chrome.storage.local.get(["defaultSpeedList"], (result) => {
        if (Array.isArray(result.defaultSpeedList)) {
          const speeds = result.defaultSpeedList.map((v: number) =>
            v.toString()
          );
          setSpeedList(speeds);
          setErrors(new Array(speeds.length).fill(""));
        } else {
          // If no valid speed list in storage, use default
          const speeds = defaultSpeedList.map((v) => v.toString());
          setSpeedList(speeds);
          setErrors(new Array(speeds.length).fill(""));
        }
      });
    } // else: skip storage access if not available
  }, []);
  // Save the current speedList to chrome.storage.local
  const handleSave = () => {
    // Validate all inputs first
    const newErrors: string[] = [];
    const hasErrors = speedList.some((speed, index) => {
      const trimmedSpeed = speed.trim();
      if (trimmedSpeed === "") {
        newErrors[index] = "Please enter a speed value";
        return true;
      }
      const num = parseFloat(trimmedSpeed);
      if (isNaN(num)) {
        newErrors[index] = "Please enter a valid number";
        return true;
      }
      if (num < 0.1 || num > 16) {
        newErrors[index] = "Speed must be between 0.1 and 16";
        return true;
      }
      newErrors[index] = "";
      return false;
    });

    setErrors(newErrors);

    if (hasErrors) {
      // Focus on the first input with error
      const firstErrorIndex = newErrors.findIndex((error) => error !== "");
      if (firstErrorIndex !== -1) {
        inputRefs.current[firstErrorIndex]?.focus();
      }
      return;
    }

    // Convert strings to numbers, apply min/max limits
    const parsedList = speedList.map((v) => {
      let num = parseFloat(v.trim());
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

    // Clear error for this input when user types
    if (errors[index]) {
      const newErrors = [...errors];
      newErrors[index] = "";
      setErrors(newErrors);
    }
  };
  const addNewSpeed = () => {
    if (speedList.length < 9) {
      setSpeedList([...speedList, ""]);
      setErrors([...errors, ""]);
      setTimeout(() => {
        const lastInput = inputRefs.current[speedList.length];
        lastInput?.focus();
      }, 0);
    }
  };
  const removeSpeed = (index: number) => {
    if (speedList.length > 1) {
      const newList = speedList.filter((_, i) => i !== index);
      const newErrors = errors.filter((_, i) => i !== index);
      setSpeedList(newList);
      setErrors(newErrors);
    }
  };
  // Reset to default speed list
  const resetToDefault = () => {
    setSpeedList(defaultSpeedList.map((speed) => speed.toString()));
    setErrors(new Array(defaultSpeedList.length).fill(""));
  };

  return (
    <div className="speed-settings-body">
      <div className="speed-settings-header">
        <div className="speed-settings-logo">
          <LogoSvg fillColor={darkMode ? "#FFFFFF" : "#000000"} />
        </div>
      </div>{" "}
      <div className="speed-settings-container">
        {" "}
        {speedList.map((speed, index) => (
          <div
            key={`speed-${index}-${speedList.length}`}
            className="speed-settings-row"
          >
            <div className="speed-settings-input-container">
              {" "}
              <input
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                className={`speed-settings-content ${
                  errors[index] ? "error" : ""
                }`}
                type="number"
                step="0.01"
                min="0.1"
                max="16"
                value={speed}
                onChange={(e) => updateSpeedValue(index, e.target.value)}
                placeholder="Enter speed (0.1-16)"
                title={
                  errors[index] || "Enter a speed value between 0.1 and 16"
                }
              />{" "}
              {speedList.length > 1 && (
                <button
                  className="speed-settings-remove-button"
                  onClick={() => removeSpeed(index)}
                  title="Remove this speed"
                >
                  ✕
                </button>
              )}
              {errors[index] && (
                <div className="speed-settings-error-message">
                  {errors[index]}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>{" "}
      <div className="speed-settings-buttons">
        <button className="speed-settings-save-button" onClick={handleSave}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"
              fill="currentColor"
            />
          </svg>
          Save
        </button>
        {speedList.length < 9 && (
          <button className="speed-settings-add-button" onClick={addNewSpeed}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"
                fill="currentColor"
              />
            </svg>
            Add
          </button>
        )}
        <button
          className="speed-settings-reset-button"
          onClick={resetToDefault}
          title="Reset to default speeds"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"
              fill="currentColor"
            />
          </svg>
          Reset
        </button>
        <button className="speed-settings-cancel-button" onClick={onClose}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
              fill="currentColor"
            />
          </svg>
          Cancel
        </button>
      </div>
    </div>
  );
}
