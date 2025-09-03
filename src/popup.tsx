import { useEffect, useState } from "react";
import { LogoSvg } from "./components/LogoSvg";
import "./styles/popup.css";
import SpeedButtons from "./components/SpeedButtons";
import PinButton from "./components/PinButton";
import ThemeButton from "./components/ThemeButton";
import EditButton from "./components/EditButton";
import SettingsButton from "./components/SettingsButton";
import Settings from "./Settings";
import SpeedSettings from "./SpeedSettings";
import { useTheme } from "./context/ThemeContext";
import DisableButton from "./components/DisableButton";

const Popup = () => {
  const { darkMode, toggleTheme } = useTheme();
  const [showSettings, setShowSettings] = useState(false);
  const [showSpeedSettings, setShowSpeedSettings] = useState(false);
  const [elementSpeed, setElementSpeed] = useState(1.0);
  const [isPinned, setIsPinned] = useState(false);
  const [tabId, setTabId] = useState<number | null>(null);
  const [isDisabled, setIsDisabled] = useState(false);

  // Helper function to check if current domain is blacklisted
  const isCurrentDomainBlacklisted = (
    blacklistDomains: any[],
    url?: string
  ): boolean => {
    if (!Array.isArray(blacklistDomains) || blacklistDomains.length === 0) {
      return false;
    }

    let hostname: string;
    try {
      hostname = url
        ? new URL(url).hostname.toLowerCase()
        : window.location.hostname.toLowerCase();
    } catch {
      return false;
    }

    return blacklistDomains.some((item) => {
      if (!item || typeof item.domain !== "string") return false;

      const blacklistedDomain = item.domain.toLowerCase();

      // Check exact match
      if (hostname === blacklistedDomain) {
        console.log(`[Popup] Domain blacklisted (exact): ${blacklistedDomain}`);
        return true;
      }

      // Check subdomain
      if (hostname.endsWith("." + blacklistedDomain)) {
        console.log(
          `[Popup] Domain blacklisted (subdomain): ${blacklistedDomain}`
        );
        return true;
      }

      // Check www variants
      const currentNoWww = hostname.startsWith("www.")
        ? hostname.substring(4)
        : hostname;
      const blacklistedNoWww = blacklistedDomain.startsWith("www.")
        ? blacklistedDomain.substring(4)
        : blacklistedDomain;

      if (currentNoWww === blacklistedNoWww) {
        console.log(
          `[Popup] Domain blacklisted (www variant): ${blacklistedDomain}`
        );
        return true;
      }

      return false;
    });
  };

  // Helper function to find domain rule for hostname
  const findDomainRuleForHostname = (domainSpeeds: any[], hostname: string) => {
    console.log("[Popup] findDomainRuleForHostname called with:", {
      domainSpeeds,
      hostname,
      domainSpeedsCount: domainSpeeds?.length || 0,
    });

    if (!Array.isArray(domainSpeeds) || domainSpeeds.length === 0) {
      console.log("[Popup] No domain speeds available");
      return null;
    }

    const hostnameNormalized = hostname.toLowerCase();
    console.log("[Popup] Normalized hostname:", hostnameNormalized);

    // Try exact match first
    for (const rule of domainSpeeds) {
      const ruleHostname = rule.domain.toLowerCase();
      console.log("[Popup] Checking exact match:", {
        ruleHostname,
        hostnameNormalized,
      });
      if (hostnameNormalized === ruleHostname) {
        console.log("[Popup] Found exact match:", rule);
        return rule;
      }
    }

    // Try www variations
    for (const rule of domainSpeeds) {
      const ruleHostname = rule.domain.toLowerCase();
      const hostnameNoWww = hostnameNormalized.startsWith("www.")
        ? hostnameNormalized.substring(4)
        : hostnameNormalized;
      const ruleNoWww = ruleHostname.startsWith("www.")
        ? ruleHostname.substring(4)
        : ruleHostname;

      console.log("[Popup] Checking www variations:", {
        ruleHostname,
        hostnameNoWww,
        ruleNoWww,
      });

      if (hostnameNoWww === ruleNoWww) {
        console.log("[Popup] Found www match:", rule);
        return rule;
      }

      // Check subdomain
      if (hostnameNormalized.endsWith("." + ruleNoWww)) {
        console.log("[Popup] Found subdomain match:", rule);
        return rule;
      }
    }

    console.log("[Popup] No domain rule found for:", hostname);
    return null;
  };

  // Helper function to determine speed for a tab
  const determineSpeedForTab = async (
    result: any,
    hostname: string,
    currentTabId: number
  ) => {
    console.log("[Popup] determineSpeedForTab called with:", {
      hostname,
      currentTabId,
      domainSpeeds: result.domainSpeeds,
      selectedSpeed: result.selectedSpeed,
      tabDomainOverrides: result[`tabDomainOverrides_${currentTabId}`],
      pinnedSpeed: result[`pinnedSpeed_${currentTabId}`],
    });

    let finalSpeed = 1.0;
    let finalPinned = false;

    // Priority 1: Pinned Speed (highest)
    if (result[`pinnedSpeed_${currentTabId}`] !== undefined) {
      finalSpeed = parseFloat(result[`pinnedSpeed_${currentTabId}`]);
      finalPinned = true;
      console.log(`[Popup] Using pinned speed: ${finalSpeed}`);
      // Clear domain rule indicator when pinned speed is active
      chrome.storage.local.remove([`activeDomainRule_${currentTabId}`]);
      return { finalSpeed, finalPinned };
    }

    // Priority 2: Domain Rule (but check if user overrode it for this tab)
    console.log("[Popup] Checking for domain rules...");
    const domainRule = findDomainRuleForHostname(
      result.domainSpeeds || [],
      hostname
    );

    // Check if user has overridden this domain rule for this specific tab
    const tabDomainOverrides =
      result[`tabDomainOverrides_${currentTabId}`] || {};
    const isOverridden = tabDomainOverrides[hostname] === true;

    if (domainRule && !isOverridden) {
      finalSpeed = domainRule.speed;
      console.log(
        `[Popup] Found active domain rule! Setting speed to: ${finalSpeed}`
      );
      chrome.storage.local.set({
        [`activeDomainRule_${currentTabId}`]: {
          domain: domainRule.domain,
          speed: domainRule.speed,
          hostname: hostname,
          tabId: currentTabId,
        },
      });
    } else {
      // Use global speed (either no domain rule or it was overridden)
      finalSpeed = result.selectedSpeed
        ? parseFloat(result.selectedSpeed)
        : 1.0;

      if (domainRule && isOverridden) {
        console.log(
          `[Popup] Domain rule exists but is overridden for this tab, using global speed: ${finalSpeed}`
        );
      } else {
        console.log(
          `[Popup] No domain rule found, using global speed: ${finalSpeed}`
        );
      }

      // Clear any active domain rule indicator for this tab since we're not using it
      chrome.storage.local.remove([`activeDomainRule_${currentTabId}`]);
    }

    return { finalSpeed, finalPinned };
  };

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const currentTabId = tabs[0]?.id;
      if (currentTabId) {
        setTabId(currentTabId);
        chrome.storage.local.get(
          [
            `pinnedSpeed_${currentTabId}`,
            `tabDomainOverrides_${currentTabId}`,
            "selectedSpeed",
            "extensionState",
            `activeDomainRule_${currentTabId}`,
            "domainSpeeds",
            "blacklistDomains",
          ],
          async (result) => {
            console.log("[Popup] Retrieved storage data:", result);

            // Set extension state first
            setIsDisabled(result.extensionState === false);

            // Priority 0: Check if current domain is blacklisted (absolute priority)
            if (
              tabs[0]?.url &&
              isCurrentDomainBlacklisted(result.blacklistDomains, tabs[0].url)
            ) {
              console.log(
                "[Popup] Current domain is blacklisted - disabling extension UI"
              );
              setIsDisabled(true);
              setElementSpeed(1.0);
              setIsPinned(false);
              // Clear any pinned speeds for this domain
              chrome.storage.local.remove([`pinnedSpeed_${currentTabId}`]);
              chrome.storage.local.remove([`activeDomainRule_${currentTabId}`]);
              return;
            }

            if (!result.selectedSpeed) {
              chrome.storage.local.set({ selectedSpeed: "1.0" });
            }

            let finalSpeed = 1.0;
            let finalPinned = false;

            // Priority 1: Check for pinned speed
            if (result[`pinnedSpeed_${currentTabId}`] !== undefined) {
              finalSpeed = parseFloat(result[`pinnedSpeed_${currentTabId}`]);
              finalPinned = true;
              console.log(`[Popup] Using pinned speed: ${finalSpeed}x`);
            }
            // Priority 2: Check for domain rules and global speed
            else if (tabs[0]?.url) {
              const hostname = new URL(tabs[0].url).hostname.toLowerCase();
              const speedResult = await determineSpeedForTab(
                result,
                hostname,
                currentTabId
              );
              finalSpeed = speedResult.finalSpeed;
              finalPinned = speedResult.finalPinned;
              console.log(`[Popup] Using determined speed: ${finalSpeed}x`);
            } else {
              // No URL available, use global speed
              finalSpeed = result.selectedSpeed
                ? parseFloat(result.selectedSpeed)
                : 1.0;
              console.log(
                `[Popup] No URL available, using global speed: ${finalSpeed}x`
              );
              chrome.storage.local.remove([`activeDomainRule_${currentTabId}`]);
            }

            setElementSpeed(finalSpeed);
            setIsPinned(finalPinned);
          }
        );
      }
    });
  }, []);

  // Storage listener for real-time updates
  useEffect(() => {
    if (tabId !== null) {
      const handleStorageChange = (changes: {
        [key: string]: chrome.storage.StorageChange;
      }) => {
        // Check for changes in tab-specific or global settings
        const pinnedKey = `pinnedSpeed_${tabId}`;
        const activeDomainRuleKey = `activeDomainRule_${tabId}`;

        if (
          changes[pinnedKey] ||
          changes[activeDomainRuleKey] ||
          changes.selectedSpeed
        ) {
          chrome.storage.local.get(
            [pinnedKey, "selectedSpeed", activeDomainRuleKey],
            (result) => {
              console.log(
                "[Popup] Storage changed, evaluating speed priority...",
                {
                  pinned: result[pinnedKey],
                  activeDomainRule: result[activeDomainRuleKey],
                  selectedSpeed: result.selectedSpeed,
                  currentIsPinned: isPinned,
                }
              );

              if (result[pinnedKey] !== undefined) {
                // Keep pinned speed - highest priority
                const pinnedSpeed = parseFloat(result[pinnedKey]);
                console.log("[Popup] Maintaining pinned speed:", pinnedSpeed);
                setElementSpeed(pinnedSpeed);
                setIsPinned(true);
              } else if (result[activeDomainRuleKey]) {
                // Keep domain rule speed - second priority
                console.log(
                  "[Popup] Maintaining domain rule speed:",
                  result[activeDomainRuleKey].speed
                );
                setElementSpeed(result[activeDomainRuleKey].speed);
                setIsPinned(false);
              } else {
                // Use global speed - lowest priority
                const globalSpeed = result.selectedSpeed
                  ? parseFloat(result.selectedSpeed)
                  : 1.0;
                console.log("[Popup] Using global speed:", globalSpeed);
                setElementSpeed(globalSpeed);
                setIsPinned(false);
              }
            }
          );
        }
      };

      chrome?.storage?.onChanged?.addListener?.(handleStorageChange);

      return () => {
        chrome?.storage?.onChanged?.removeListener?.(handleStorageChange);
      };
    }
  }, [tabId]);

  useEffect(() => {
    if (tabId !== null) {
      chrome.storage.local.get(
        [`pinnedSpeed_${tabId}`, "selectedSpeed", `activeDomainRule_${tabId}`],
        (result) => {
          console.log("[Popup] Storage changed, evaluating speed priority...", {
            pinned: result[`pinnedSpeed_${tabId}`],
            activeDomainRule: result[`activeDomainRule_${tabId}`],
            selectedSpeed: result.selectedSpeed,
            currentIsPinned: isPinned,
          });

          if (isPinned && result[`pinnedSpeed_${tabId}`] !== undefined) {
            // Keep pinned speed - highest priority
            const pinnedSpeed = parseFloat(result[`pinnedSpeed_${tabId}`]);
            console.log("[Popup] Maintaining pinned speed:", pinnedSpeed);
            setElementSpeed(pinnedSpeed);
          } else if (result[`activeDomainRule_${tabId}`]) {
            // Keep domain rule speed - second priority
            console.log(
              "[Popup] Maintaining domain rule speed:",
              result[`activeDomainRule_${tabId}`].speed
            );
            setElementSpeed(result[`activeDomainRule_${tabId}`].speed);
          } else {
            // Use global speed - lowest priority
            const globalSpeed = result.selectedSpeed
              ? parseFloat(result.selectedSpeed)
              : 1.0;
            console.log("[Popup] Using global speed:", globalSpeed);
            setElementSpeed(globalSpeed);
          }
        }
      );
    }
  }, [tabId, isPinned]); // Remove elementSpeed dependency to prevent conflicts
  useEffect(() => {
    // Only send speed updates when extension is enabled and we have valid state
    if (tabId !== null && elementSpeed && !isDisabled) {
      chrome.tabs.sendMessage(tabId, {
        type: "UPDATE_SPEED",
        speed: elementSpeed,
      });
    }
    // When extension is disabled, ensure content script knows
    if (tabId !== null && isDisabled) {
      chrome.tabs.sendMessage(tabId, {
        type: "DISABLE_SPEEDYVIDEO",
      });
    }
  }, [elementSpeed, tabId, isDisabled]);

  if (showSettings) {
    return <Settings onClose={() => setShowSettings(false)} />;
  }

  if (showSpeedSettings) {
    return <SpeedSettings onClose={() => setShowSpeedSettings(false)} />;
  }
  const handleDisable = () => {
    const newDisabled = !isDisabled;
    setIsDisabled(newDisabled);

    // Update global state
    chrome.storage.local.set({ extensionState: !newDisabled });

    // Send appropriate message to background script
    chrome.runtime.sendMessage({
      type: newDisabled
        ? "DISABLE_SPEEDYVIDEO_GLOBAL"
        : "ENABLE_SPEEDYVIDEO_GLOBAL",
    });

    // Send message to current tab with callback to ensure it's received
    if (tabId !== null) {
      const messageType = newDisabled
        ? "DISABLE_SPEEDYVIDEO"
        : "ENABLE_SPEEDYVIDEO";
      chrome.tabs.sendMessage(tabId, { type: messageType }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn(
            "[SpeedyVideo] Error sending message to tab:",
            chrome.runtime.lastError.message
          );
        } else {
          console.log(
            `[SpeedyVideo] ${messageType} sent successfully:`,
            response
          );

          // If we're enabling, always apply the current speed
          if (!newDisabled) {
            setTimeout(() => {
              chrome.tabs.sendMessage(tabId, {
                type: "UPDATE_SPEED",
                speed: elementSpeed,
              });
            }, 100);
          }
        }
      });
    }
  };

  const handleEnable = (targetSpeed?: number) => {
    if (!isDisabled) return; // Already enabled

    const speedToApply = targetSpeed ?? elementSpeed;

    // Update the speed state immediately if a target speed is provided
    if (targetSpeed !== undefined) {
      setElementSpeed(targetSpeed);
    }

    setIsDisabled(false);

    // Update global state
    chrome.storage.local.set({ extensionState: true });

    // Send enable message to background script
    chrome.runtime.sendMessage({
      type: "ENABLE_SPEEDYVIDEO_GLOBAL",
    });

    // Send message to current tab
    if (tabId !== null) {
      chrome.tabs.sendMessage(
        tabId,
        { type: "ENABLE_SPEEDYVIDEO" },
        (response) => {
          if (chrome.runtime.lastError) {
            console.warn(
              "[SpeedyVideo] Error sending enable message to tab:",
              chrome.runtime.lastError.message
            );
          } else {
            console.log(
              "[SpeedyVideo] ENABLE_SPEEDYVIDEO sent successfully:",
              response
            );

            // Apply the speed after enabling
            setTimeout(() => {
              chrome.tabs.sendMessage(tabId, {
                type: "UPDATE_SPEED",
                speed: speedToApply,
              });
            }, 100);
          }
        }
      );
    }
  };

  return (
    <div>
      <div className="header">
        <div className="left-icons">
          <DisableButton
            fillColor={darkMode ? "#FFFFFF" : "#000000"}
            onClick={handleDisable}
            isDisabled={isDisabled}
          />
          <ThemeButton
            fillColor={darkMode ? "#FFFFFF" : "#000000"}
            onClick={toggleTheme}
          />
          <div className="spacer"></div>
        </div>
        <div className="center-logo">
          <LogoSvg fillColor={darkMode ? "#FFFFFF" : "#000000"} />
        </div>
        <div className="right-icons">
          <SettingsButton
            fillColor={darkMode ? "#FFFFFF" : "#000000"}
            onClick={() => setShowSettings(true)}
          />
          <PinButton
            fillColor={darkMode ? "#FFFFFF" : "#000000"}
            selectedSpeed={elementSpeed}
            setIsPinned={setIsPinned}
            setTabId={setTabId}
          />
          <EditButton
            onClick={() => setShowSpeedSettings(true)}
            fillColor={darkMode ? "#FFFFFF" : "#000000"}
          />
        </div>
      </div>{" "}
      <SpeedButtons
        elementSpeed={elementSpeed}
        setElementSpeed={isDisabled ? () => {} : setElementSpeed}
        isPinned={isPinned}
        tabId={tabId}
        isDisabled={isDisabled}
        onEnableExtension={handleEnable}
      />
      <div className="footer">
        <a href="https://github.com/REDLANTERNDEV/speedyvideo" target="_blank">
          <svg
            width="25"
            height="25"
            viewBox="0 0 25 25"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12.5 1.04166C9.49321 1.01111 6.59729 2.17563 4.4487 4.27929C2.30011 6.38296 1.07467 9.25363 1.04169 12.2604C1.05327 14.6366 1.81767 16.948 3.22509 18.8627C4.6325 20.7773 6.61051 22.1966 8.87502 22.9167C9.44794 23.0208 9.65627 22.6771 9.65627 22.375C9.65627 22.0729 9.65627 21.4062 9.65627 20.4687C6.46877 21.1458 5.79169 18.9687 5.79169 18.9687C5.5795 18.2853 5.12839 17.7011 4.52085 17.3229C3.47919 16.6354 4.60419 16.6458 4.60419 16.6458C4.96424 16.694 5.30872 16.823 5.6118 17.0232C5.91488 17.2235 6.16869 17.4898 6.35419 17.8021C6.67745 18.3626 7.20787 18.7738 7.83128 18.9472C8.4547 19.1206 9.12126 19.0423 9.68752 18.7292C9.74576 18.1587 10.0041 17.6273 10.4167 17.2292C7.87502 16.9479 5.20835 15.9896 5.20835 11.6875C5.18562 10.5653 5.60027 9.47824 6.3646 8.65625C6.01651 7.69278 6.05761 6.63157 6.47919 5.69791C6.47919 5.69791 7.44794 5.39583 9.60419 6.84375C11.4812 6.34358 13.4564 6.34358 15.3334 6.84375C17.5209 5.39583 18.4584 5.69791 18.4584 5.69791C18.8799 6.63157 18.921 7.69278 18.5729 8.65625C19.355 9.46317 19.7922 10.5429 19.7917 11.6667C19.7917 15.9792 17.1042 16.9271 14.5834 17.2083C14.8594 17.4763 15.0726 17.8021 15.2077 18.1624C15.3428 18.5226 15.3964 18.9083 15.3646 19.2917V22.3646C15.3646 22.3646 15.5729 23.0208 16.1459 22.9062C18.4039 22.1817 20.3753 20.762 21.7783 18.8501C23.1814 16.9382 23.9444 14.6319 23.9584 12.2604C23.9254 9.25363 22.6999 6.38296 20.5513 4.27929C18.4028 2.17563 15.5068 1.01111 12.5 1.04166Z"
              fill={darkMode ? "#FFFFFF" : "#000000"}
            />
          </svg>
        </a>
      </div>
    </div>
  );
};

export default Popup;
