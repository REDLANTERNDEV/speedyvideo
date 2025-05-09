import { useState, useEffect } from "react";

const defaultSpeedList = [0.5, 1.0, 1.1, 1.5, 2.0, 2.5, 3.0, 8.0, 16.0];

interface SpeedButtonsProps {
  readonly elementSpeed: number;
  readonly setElementSpeed: (speed: number) => void;
  readonly isPinned: boolean;
  readonly tabId: number | null;
}

function SpeedButtons({
  elementSpeed,
  setElementSpeed,
  isPinned,
  tabId,
}: SpeedButtonsProps) {
  const [speedList, setSpeedList] = useState<number[]>(defaultSpeedList);

  useEffect(() => {
    chrome?.storage?.local?.get(["defaultSpeedList"], (result) => {
      setSpeedList(
        Array.isArray(result.defaultSpeedList) &&
          result.defaultSpeedList.length > 0
          ? result.defaultSpeedList
          : defaultSpeedList
      );
    });
  }, []);

  const handleClick = (speed: number) => {
    setElementSpeed(speed);
    if (isPinned && tabId !== null) {
      chrome.storage.local.set({ [`pinnedSpeed_${tabId}`]: speed });
      chrome.tabs?.sendMessage?.(tabId, { type: "UPDATE_SPEED", speed });
    } else {
      chrome.storage.local.set({ selectedSpeed: speed.toString() });
      chrome.tabs?.query?.({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: "UPDATE_SPEED",
            speed,
          });
        }
      });
    }
  };

  useEffect(() => {
    chrome?.storage?.local?.set({ defaultSpeedList: speedList });
  }, [speedList]);

  // Eğer elementSpeed, speedList içinde yoksa hiçbir buton seçili olmasın
  const isSpeedInList = speedList.some(
    (speed) => speed.toFixed(2) === elementSpeed.toFixed(2)
  );

  return (
    <div className="container">
      {speedList.map((speedValue) => (
        <button
          key={speedValue}
          data-speed={speedValue.toFixed(2)}
          className={`content ${
            isSpeedInList && speedValue.toFixed(2) === elementSpeed.toFixed(2)
              ? "active"
              : ""
          }`}
          onClick={() => handleClick(speedValue)}
        >
          {speedValue.toFixed(2)}
        </button>
      ))}
    </div>
  );
}

export default SpeedButtons;
