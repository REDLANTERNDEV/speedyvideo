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
      // When not pinned, check if there's an active domain rule to update
      chrome.tabs?.query?.({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.url && tabId) {
          const hostname = new URL(tabs[0].url).hostname.toLowerCase();

          // Check if there's an active domain rule for this tab
          if (activeDomainRule && activeDomainRule.hostname === hostname) {
            // User is changing speed on a domain with a rule
            // This should update global speed and override the domain rule for this tab only
            // The domain rule itself should remain unchanged for future tabs

            // Update global speed
            chrome.storage.local.set({
              selectedSpeed: speed.toString(),
            });

            // Clear the domain rule indicator for this specific tab
            // This makes the tab use global speed instead of domain rule
            chrome.storage.local.remove(`activeDomainRule_${tabId}`);

            // Mark that user disabled domain rule for this specific tab
            chrome.storage.local.set({
              [`domainRuleDisabled_${tabId}`]: {
                hostname: hostname,
                disabledAt: Date.now(),
              },
            });

            log(
              `User changed speed to ${speed}x, switching from domain rule to global speed for this tab.`
            );
          } else {
            // No active domain rule, update global speed
            chrome.storage.local.set({
              selectedSpeed: speed.toString(),
            });

            log(`Updated global speed to ${speed}x.`);
          }
        }
      });
    }

    // Send speed update to the content script
    if (typeof tabId === "number") {
      chrome.tabs?.sendMessage?.(
        tabId,
        {
          type: "UPDATE_SPEED",
          speed,
          source: "user-action",
        },
        () => {
          if (chrome.runtime.lastError) {
            console.warn(
              "[SpeedyVideo] Error sending speed update:",
              chrome.runtime.lastError.message
            );
          } else {
            console.log(
              `[SpeedButtons] Speed updated to ${speed}x successfully`
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
