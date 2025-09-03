import { useState, useEffect } from "react";

const defaultSpeedList = [0.5, 1.0, 1.1, 1.5, 2.0, 2.5, 3.0, 8.0, 16.0];

interface SpeedButtonsProps {
  readonly elementSpeed: number;
  readonly setElementSpeed: (speed: number) => void;
  readonly isPinned: boolean;
  readonly tabId: number | null;
  readonly isDisabled: boolean;
  readonly onEnableExtension?: (targetSpeed?: number) => void;
}

interface ActiveDomainRule {
  domain: string;
  speed: number;
  hostname: string;
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
  const [activeDomainRule, setActiveDomainRule] =
    useState<ActiveDomainRule | null>(null);

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

  useEffect(() => {
    // Listen for active domain rule changes for current tab
    if (tabId !== null) {
      chrome?.storage?.local?.get([`activeDomainRule_${tabId}`], (result) => {
        console.log(
          `[SpeedyVideo] Loading activeDomainRule for tab ${tabId} from storage:`,
          result[`activeDomainRule_${tabId}`]
        );
        setActiveDomainRule(result[`activeDomainRule_${tabId}`] || null);
      });

      // Set up listener for storage changes to update domain rule in real-time
      const handleStorageChange = (changes: {
        [key: string]: chrome.storage.StorageChange;
      }) => {
        const activeDomainRuleKey = `activeDomainRule_${tabId}`;
        if (changes[activeDomainRuleKey]) {
          console.log(
            `[SpeedyVideo] activeDomainRule for tab ${tabId} changed:`,
            changes[activeDomainRuleKey].newValue
          );
          setActiveDomainRule(changes[activeDomainRuleKey].newValue || null);
        }
      };

      chrome?.storage?.onChanged?.addListener?.(handleStorageChange);

      return () => {
        chrome?.storage?.onChanged?.removeListener?.(handleStorageChange);
      };
    }
  }, [tabId]);
  const handleClick = (speed: number) => {
    if (isDisabled) {
      if (onEnableExtension) {
        onEnableExtension(speed);
      }
      return;
    }

    setElementSpeed(speed);

    // If the tab is pinned, only update the pinned speed for this tab.
    // Do not affect the global speed or domain overrides.
    if (isPinned && tabId !== null) {
      chrome.storage.local.set({ [`pinnedSpeed_${tabId}`]: speed });
      log(`Set pinned speed for tab ${tabId} to ${speed}x.`);
    } else {
      // When not pinned, a user click overrides any domain rule for the current tab
      // and updates the global speed.
      chrome.tabs?.query?.({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.url && tabId) {
          const hostname = new URL(tabs[0].url).hostname.toLowerCase();
          const overrideKey = `tabDomainOverrides_${tabId}`;

          // Mark this domain as overridden for this tab and update global speed
          chrome.storage.local.get([overrideKey], (result) => {
            const tabDomainOverrides = result[overrideKey] || {};
            tabDomainOverrides[hostname] = true;

            chrome.storage.local.set({
              [overrideKey]: tabDomainOverrides,
              selectedSpeed: speed.toString(), // Update global speed
            });

            // Clear the visual indicator for the domain rule for this specific tab
            chrome.storage.local.remove(`activeDomainRule_${tabId}`);

            log(
              `User action overrode domain rule. Set global speed to ${speed}x and marked ${hostname} as overridden for tab ${tabId}.`
            );
          });
        }
      });
    }

    // Send speed update to the content script regardless of pin state
    if (typeof tabId === "number") {
      chrome.tabs?.sendMessage?.(
        tabId,
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
  };

  // Simple log function for this component
  const log = (message: string) => {
    console.log(`[SpeedyVideo Popup] ${message}`);
  };

  useEffect(() => {
    chrome?.storage?.local?.set({ defaultSpeedList: speedList });
  }, [speedList]);

  return (
    <div className="container">
      {speedList.map((speedValue) => {
        // Check if this speed matches the active domain rule
        const isDomainRuleSpeed =
          activeDomainRule &&
          speedValue.toFixed(2) === activeDomainRule.speed.toFixed(2);

        // Determine if this button should be "active" (selected)
        const isCurrentSpeed = (() => {
          // Always allow showing active state for the current speed
          return speedValue.toFixed(2) === elementSpeed.toFixed(2);
        })();

        const isDifferentSpeed =
          speedValue.toFixed(2) !== elementSpeed.toFixed(2);

        let buttonTitle: string;
        if (isDisabled && isDifferentSpeed) {
          buttonTitle = `Click to enable extension and set speed to ${speedValue.toFixed(
            2
          )}x`;
        } else if (isDisabled) {
          buttonTitle = "Extension is disabled";
        } else if (isDomainRuleSpeed && isCurrentSpeed) {
          buttonTitle = `Domain rule: ${
            activeDomainRule.domain
          } → ${speedValue.toFixed(2)}x (active)`;
        } else if (isDomainRuleSpeed) {
          buttonTitle = `Domain rule: ${
            activeDomainRule.domain
          } → ${speedValue.toFixed(2)}x`;
        } else {
          buttonTitle = `Set speed to ${speedValue.toFixed(2)}x`;
        }

        return (
          <button
            key={speedValue}
            data-speed={speedValue.toFixed(2)}
            className={`content ${isCurrentSpeed ? "active" : ""} ${
              isDomainRuleSpeed ? "domain-rule" : ""
            } ${
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
