import { useState, useEffect } from "react";

const defaultSpeedList = [0.5, 1.0, 1.1, 1.5, 2.0, 2.5, 3.0, 8.0, 16.0];

interface SpeedButtonsProps {
  readonly elementSpeed: number;
  readonly setElementSpeed: (speed: number) => void;
  readonly isPinned: boolean;
  readonly tabId: number | null;
  readonly isDisabled: boolean;
  readonly onEnableExtension?: () => void;
}

function SpeedButtons({
  elementSpeed,
  setElementSpeed,
  isPinned,
  tabId,
  isDisabled,
  onEnableExtension,
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
    // Auto-enable extension when disabled and different speed is selected
    if (isDisabled && speed !== elementSpeed) {
      console.log(
        `[SpeedyVideo] Auto-enabling extension - current: ${elementSpeed}, selected: ${speed}`
      );
      onEnableExtension?.(); // Enable the extension
      // Update the speed as well
      setTimeout(() => {
        setElementSpeed(speed);
        if (isPinned && tabId !== null) {
          chrome.storage.local.set({ [`pinnedSpeed_${tabId}`]: speed });
          chrome.tabs?.sendMessage?.(
            tabId,
            { type: "UPDATE_SPEED", speed },
            (_response) => {
              if (chrome.runtime.lastError) {
                console.warn(
                  "[SpeedyVideo] Error sending pinned speed update:",
                  chrome.runtime.lastError.message
                );
              }
            }
          );
        } else {
          chrome.storage.local.set({ selectedSpeed: speed.toString() });
          chrome.tabs?.query?.(
            { active: true, currentWindow: true },
            (tabs) => {
              if (tabs[0]?.id) {
                chrome.tabs.sendMessage(
                  tabs[0].id,
                  {
                    type: "UPDATE_SPEED",
                    speed,
                  },
                  (_response) => {
                    if (chrome.runtime.lastError) {
                      console.warn(
                        "[SpeedyVideo] Error sending speed update:",
                        chrome.runtime.lastError.message
                      );
                    }
                  }
                );
              }
            }
          );
        }
      }, 200); // Wait for extension to be enabled
      return;
    }

    // Do nothing when extension is disabled and same speed is selected
    if (isDisabled) {
      return;
    }

    // Normal operation: when extension is enabled
    setElementSpeed(speed);
    if (isPinned && tabId !== null) {
      chrome.storage.local.set({ [`pinnedSpeed_${tabId}`]: speed });
      chrome.tabs?.sendMessage?.(
        tabId,
        { type: "UPDATE_SPEED", speed },
        (_response) => {
          if (chrome.runtime.lastError) {
            console.warn(
              "[SpeedyVideo] Error sending pinned speed update:",
              chrome.runtime.lastError.message
            );
          }
        }
      );
    } else {
      chrome.storage.local.set({ selectedSpeed: speed.toString() });
      chrome.tabs?.query?.({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(
            tabs[0].id,
            {
              type: "UPDATE_SPEED",
              speed,
            },
            (_response) => {
              if (chrome.runtime.lastError) {
                console.warn(
                  "[SpeedyVideo] Error sending speed update:",
                  chrome.runtime.lastError.message
                );
              }
            }
          );
        }
      });
    }
  };

  useEffect(() => {
    chrome?.storage?.local?.set({ defaultSpeedList: speedList });
  }, [speedList]);

  const isSpeedInList = speedList.some(
    (speed) => speed.toFixed(2) === elementSpeed.toFixed(2)
  );
  return (
    <div className="container">
      {speedList.map((speedValue) => {
        const isCurrentSpeed =
          isSpeedInList && speedValue.toFixed(2) === elementSpeed.toFixed(2);
        const isDifferentSpeed =
          speedValue.toFixed(2) !== elementSpeed.toFixed(2);

        let buttonTitle: string;
        if (isDisabled && isDifferentSpeed) {
          buttonTitle = `Click to enable extension and set speed to ${speedValue.toFixed(
            2
          )}x`;
        } else if (isDisabled) {
          buttonTitle = "Extension is disabled";
        } else {
          buttonTitle = `Set speed to ${speedValue.toFixed(2)}x`;
        }

        return (
          <button
            key={speedValue}
            data-speed={speedValue.toFixed(2)}
            className={`content ${isCurrentSpeed ? "active" : ""} ${
              isDisabled && isDifferentSpeed ? "clickable-when-disabled" : ""
            } ${isDisabled ? "disabled" : ""}`}
            onClick={() => handleClick(speedValue)}
            title={buttonTitle}
          >
            {speedValue.toFixed(2)}
          </button>
        );
      })}
    </div>
  );
}

export default SpeedButtons;
