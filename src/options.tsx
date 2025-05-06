import { useEffect, useState } from "react";
import "./styles/options.css";
import { LogoSvg } from "./components/LogoSvg";
import { useTheme } from "./context/ThemeContext";

export default function Options({ onClose }: { readonly onClose: () => void }) {
  const [speedList, setSpeedList] = useState<number[]>([]);
  const { darkMode } = useTheme();

  useEffect(() => {
    if (chrome?.storage?.local) {
      chrome.storage.local.get(["defaultSpeedList"], (result) => {
        if (Array.isArray(result.defaultSpeedList)) {
          setSpeedList(result.defaultSpeedList);
        }
      });
    }
    // else: skip storage access if not available
  }, []);

  // Save the current speedList to chrome.storage.local
  const handleSave = () => {
    if (chrome?.storage?.local) {
      chrome.storage.local.set({ defaultSpeedList: speedList }, () => {
        onClose();
      });
    } else {
      onClose();
    }
  };

  // Extracted handler to reduce nesting
  const handleSpeedChange = (
    idx: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    let newValue = parseFloat(e.target.value);
    if (isNaN(newValue)) newValue = 0.1;
    if (newValue > 16) newValue = 16;
    if (newValue < 0.1) newValue = 0.1;
    setSpeedList((list) => list.map((v, i) => (i === idx ? newValue : v)));
  };

  return (
    <div className="options-body">
      <div className="options-header">
        <div className="options-logo">
          <LogoSvg fillColor={darkMode ? "#FFFFFF" : "#000000"} />
        </div>
      </div>
      <div className="options-container">
        {speedList.map((speedValue, idx) => (
          <input
            key={speedValue}
            type="number"
            data-speed={speedValue}
            className="options-content"
            value={speedValue}
            step={0.1}
            min={0.1}
            max={16}
            onChange={(e) => handleSpeedChange(idx, e)}
          />
        ))}
      </div>
      <div className="options-buttons">
        <button className="options-save-button" onClick={handleSave}>
          Save
        </button>
        <button className="options-cancel-button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
