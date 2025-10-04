// Log when the background service is installed or restarted
chrome.runtime.onInstalled.addListener(() => {
  console.log("[SpeedyVideo Background] Service worker installed.");

  // Initialize default exclusion patterns if not already set
  initializeDefaultExclusions();

  // Clean up old data structures for privacy
  cleanupLegacyData();

  // Clean up orphaned pinned speeds on installation/restart
  cleanupOrphanedPinnedSpeeds();

  // Set up keep-alive mechanism
  setupKeepAlive();
});

// Service worker startup listener
chrome.runtime.onStartup.addListener(() => {
  console.log("[SpeedyVideo Background] Service worker started.");
  setupKeepAlive();
});

// Handle service worker suspend/resume
if ("serviceWorker" in navigator) {
  // Additional recovery mechanism
  self.addEventListener("activate", () => {
    console.log("[SpeedyVideo Background] Service worker activated");
    setupKeepAlive();
  });
}

// Global error handler for background script
self.addEventListener("error", (event) => {
  console.error("[SpeedyVideo Background] Global error:", event.error);
  // Try to recover by reinitializing
  setTimeout(() => {
    setupKeepAlive();
  }, 1000);
});

self.addEventListener("unhandledrejection", (event) => {
  console.error(
    "[SpeedyVideo Background] Unhandled promise rejection:",
    event.reason
  );
});

// Keep-alive mechanism to prevent service worker from sleeping
function setupKeepAlive() {
  // Send a ping message every 15 seconds to keep service worker alive (more aggressive)
  const keepAliveInterval = setInterval(() => {
    chrome.tabs.query({}, (tabs) => {
      // Just querying tabs is enough to keep service worker alive
      console.log(
        `[SpeedyVideo Background] Keep-alive ping - ${tabs.length} tabs open`
      );

      // Also perform a small storage operation to keep context active
      chrome.storage.local.get(["extensionState"], () => {
        // This keeps storage API active
      });
    });
  }, 15000); // 15 seconds (was 20)

  // Store interval ID for cleanup if needed
  (globalThis as any).keepAliveInterval = keepAliveInterval;
}

// Function to initialize default exclusion patterns
function initializeDefaultExclusions() {
  chrome.storage.local.get(
    ["websitesAddedToUrlConditionsExclusion"],
    (result) => {
      if (!result.websitesAddedToUrlConditionsExclusion) {
        const defaultExclusions = [
          "starts_https://docs.google.com",
          "starts_https://play.geforcenow.com",
          "starts_https://www.xbox.com",
          "starts_https://docs.qq.com",
          "starts_https://www.playstation.com",
          "starts_https://excalidraw.com",
          "starts_https://www.photopea.com",
          "starts_https://www.canva.com",
          "starts_http://luna.amazon.com",
          "starts_https://ys.mihoyo.com",
          "starts_https://www.youtube.com/playables",
          "starts_https://stadia.google.com",
          "starts_https://www.nvidia.com/en-us/geforce-now",
          "starts_https://games.amazon.com",
        ];

        chrome.storage.local.set(
          {
            websitesAddedToUrlConditionsExclusion: defaultExclusions,
          },
          () => {
            console.log(
              "[SpeedyVideo Background] Default exclusion patterns initialized"
            );
          }
        );
      } else {
        console.log(
          "[SpeedyVideo Background] Exclusion patterns already exist"
        );
      }
    }
  );
}

// Function to clean up legacy data for privacy and storage optimization
function cleanupLegacyData() {
  chrome.storage.local.get(null, (allData) => {
    const keysToRemove: string[] = [];

    // Find all tabDomainOverrides keys (old privacy-invasive system)
    Object.keys(allData).forEach((key) => {
      if (key.startsWith("tabDomainOverrides_")) {
        keysToRemove.push(key);
      }
    });

    // Also clean up the new consolidated tabDomainOverrides if it exists
    if (allData.tabDomainOverrides) {
      keysToRemove.push("tabDomainOverrides");
    }

    if (keysToRemove.length > 0) {
      chrome.storage.local.remove(keysToRemove, () => {
        console.log(
          `[SpeedyVideo Background] Removed ${keysToRemove.length} legacy data keys for privacy`
        );
      });
    }

    // Notify content scripts to clean up localStorage
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (
          tab.id &&
          tab.url &&
          (tab.url.startsWith("http://") || tab.url.startsWith("https://"))
        ) {
          chrome.tabs.sendMessage(
            tab.id,
            { type: "CLEANUP_LEGACY_DATA" },
            () => {
              // Ignore errors for tabs that don't have content script loaded
              if (chrome.runtime.lastError) {
                // Silent ignore
              }
            }
          );
        }
      });
    });
  });
}

// Function to clean up orphaned data (pinned speeds and active domain rules)
async function cleanupOrphanedPinnedSpeeds() {
  try {
    // Get all storage keys
    const allData = await chrome.storage.local.get(null);
    const pinnedSpeedKeys: string[] = [];
    const activeDomainRuleKeys: string[] = [];
    const tabDomainOverrideKeys: string[] = [];

    // Find all tab-specific keys
    Object.keys(allData).forEach((key) => {
      if (key.startsWith("pinnedSpeed_")) {
        pinnedSpeedKeys.push(key);
      } else if (key.startsWith("activeDomainRule_")) {
        activeDomainRuleKeys.push(key);
      } else if (key.startsWith("tabDomainOverrides_")) {
        tabDomainOverrideKeys.push(key);
      }
    });

    // Get all current tab IDs
    const tabs = await chrome.tabs.query({});
    const currentTabIds = new Set(
      tabs.map((tab) => tab.id?.toString()).filter(Boolean)
    );

    // Find orphaned keys (those without corresponding active tabs)
    const orphanedKeys: string[] = [];

    pinnedSpeedKeys.forEach((key) => {
      const tabId = key.replace("pinnedSpeed_", "");
      if (!currentTabIds.has(tabId)) {
        orphanedKeys.push(key);
      }
    });

    activeDomainRuleKeys.forEach((key) => {
      const tabId = key.replace("activeDomainRule_", "");
      if (!currentTabIds.has(tabId)) {
        orphanedKeys.push(key);
      }
    });

    tabDomainOverrideKeys.forEach((key) => {
      const tabId = key.replace("tabDomainOverrides_", "");
      if (!currentTabIds.has(tabId)) {
        orphanedKeys.push(key);
      }
    });

    // Remove orphaned keys
    if (orphanedKeys.length > 0) {
      await chrome.storage.local.remove(orphanedKeys);
      console.log(
        `[SpeedyVideo Background] Cleaned up ${orphanedKeys.length} orphaned keys:`,
        orphanedKeys
      );
    }

    // Also clean the tabDomainOverrides object
    const tabDomainOverrides = allData.tabDomainOverrides || {};
    const cleanedOverrides: { [tabId: string]: any } = {};
    let cleanedCount = 0;
    Object.keys(tabDomainOverrides).forEach((tabId) => {
      if (currentTabIds.has(tabId)) {
        cleanedOverrides[tabId] = tabDomainOverrides[tabId];
      } else {
        cleanedCount++;
      }
    });
    if (cleanedCount > 0) {
      await chrome.storage.local.set({ tabDomainOverrides: cleanedOverrides });
      console.log(
        `[SpeedyVideo Background] Cleaned up ${cleanedCount} orphaned entries in tabDomainOverrides`
      );
    }
  } catch (error) {
    console.error("[SpeedyVideo Background] Error during cleanup:", error);
  }
}

// Periodic cleanup every 2 minutes (more frequent to catch orphaned data faster)
setInterval(() => {
  cleanupOrphanedPinnedSpeeds();
}, 2 * 60 * 1000);

// Listen for disable/enable messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "DISABLE_SPEEDYVIDEO_GLOBAL") {
    chrome.storage.local.set({ extensionState: false }, () => {
      // Disable on all open tabs
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          if (
            tab.id !== undefined &&
            tab.url &&
            (tab.url.startsWith("http://") || tab.url.startsWith("https://"))
          ) {
            chrome.tabs.sendMessage(tab.id, { type: "DISABLE_SPEEDYVIDEO" });
          }
        });
      });
      sendResponse({ status: "disabled globally" });
    });
    return true;
  } else if (message.type === "ENABLE_SPEEDYVIDEO_GLOBAL") {
    chrome.storage.local.set({ extensionState: true }, () => {
      // Enable on all open tabs
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          if (
            tab.id !== undefined &&
            tab.url &&
            (tab.url.startsWith("http://") || tab.url.startsWith("https://"))
          ) {
            chrome.tabs.sendMessage(tab.id, { type: "ENABLE_SPEEDYVIDEO" });
          }
        });
      });
      sendResponse({ status: "enabled globally" });
    });
    return true;
  } else if (message.type === "GET_CURRENT_TAB") {
    // Return the tab ID from sender
    if (sender.tab?.id) {
      sendResponse({ tabId: sender.tab.id });
    } else {
      sendResponse({ tabId: null });
    }
    return true;
  }
});

// Helper function to find domain rule for hostname (same logic as popup and content)
function findDomainRuleForHostname(domainSpeeds: any[], hostname: string) {
  if (!Array.isArray(domainSpeeds) || domainSpeeds.length === 0) {
    return null;
  }

  const hostnameNormalized = hostname.toLowerCase();

  // Try exact match first
  for (const rule of domainSpeeds) {
    const ruleHostname = rule.domain.toLowerCase();
    if (hostnameNormalized === ruleHostname) {
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

    if (hostnameNoWww === ruleNoWww) {
      return rule;
    }

    // Check subdomain
    if (hostnameNormalized.endsWith("." + ruleNoWww)) {
      return rule;
    }
  }

  return null;
}

// Helper function to check if hostname is blacklisted
function isHostnameBlacklisted(
  blacklistDomains: any[],
  hostname: string
): boolean {
  if (!Array.isArray(blacklistDomains) || blacklistDomains.length === 0) {
    return false;
  }

  const currentHostname = hostname.toLowerCase();

  for (const item of blacklistDomains) {
    if (!item || typeof item.domain !== "string") continue;

    const blacklistedDomain = item.domain.toLowerCase();

    // Check exact match
    if (currentHostname === blacklistedDomain) {
      return true;
    }

    // Check if current hostname is a subdomain of blacklisted domain
    if (currentHostname.endsWith("." + blacklistedDomain)) {
      return true;
    }

    // Check if blacklisted domain includes www and current doesn't (or vice versa)
    const currentNoWww = currentHostname.startsWith("www.")
      ? currentHostname.substring(4)
      : currentHostname;
    const blacklistedNoWww = blacklistedDomain.startsWith("www.")
      ? blacklistedDomain.substring(4)
      : blacklistedDomain;

    if (currentNoWww === blacklistedNoWww) {
      return true;
    }
  }

  return false;
}

// Helper function to determine speed and source for a tab
function determineSpeedForTab(
  tabId: number,
  tabUrl: string | undefined,
  result: any
): { speed: number; speedSource: string } {
  // Priority 1: Pinned Speed
  if (result[`pinnedSpeed_${tabId}`] !== undefined) {
    return {
      speed: parseFloat(result[`pinnedSpeed_${tabId}`]),
      speedSource: "pinned",
    };
  }

  // Priority 2: Domain Rule
  if (tabUrl) {
    const hostname = new URL(tabUrl).hostname.toLowerCase();
    const domainRule = findDomainRuleForHostname(
      result.domainSpeeds || [],
      hostname
    );

    if (domainRule) {
      return {
        speed: domainRule.speed,
        speedSource: "domain rule",
      };
    }
  }

  // Priority 3: Global Speed (fallback)
  return {
    speed: result.selectedSpeed ? parseFloat(result.selectedSpeed) : 1,
    speedSource: "global",
  };
}

// When a tab is updated and finished loading, apply systematic speed determination
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    (tab.url.startsWith("http://") || tab.url.startsWith("https://"))
  ) {
    // Add a small delay to ensure page is fully loaded
    setTimeout(() => {
      chrome.storage.local.get(
        [
          "extensionState",
          "selectedSpeed",
          `pinnedSpeed_${tabId}`,
          "domainSpeeds",
          "blacklistDomains",
        ],
        (result) => {
          if (result.extensionState === false) {
            chrome.tabs.sendMessage(tabId, { type: "DISABLE_SPEEDYVIDEO" });
            return;
          }

          const hostname = new URL(tab.url!).hostname.toLowerCase();

          // Check if current domain is blacklisted (highest priority)
          if (isHostnameBlacklisted(result.blacklistDomains || [], hostname)) {
            console.log(
              `[SpeedyVideo Background] Domain ${hostname} is blacklisted`
            );
            chrome.tabs.sendMessage(tabId, { type: "DISABLE_SPEEDYVIDEO" });
            return;
          }

          const { speed, speedSource } = determineSpeedForTab(
            tabId,
            tab.url,
            result
          );

          console.log(
            `[SpeedyVideo Background] Tab ${tabId} (${hostname}) using ${speedSource} speed: ${speed}`
          );

          // Update activeDomainRule based on speed source
          const domainRule = findDomainRuleForHostname(
            result.domainSpeeds || [],
            hostname
          );
          if (domainRule && speedSource === "domain rule") {
            chrome.storage.local.set({
              [`activeDomainRule_${tabId}`]: {
                domain: domainRule.domain,
                speed: domainRule.speed,
                hostname: hostname,
                tabId: tabId,
              },
            });
          } else {
            chrome.storage.local.remove([`activeDomainRule_${tabId}`]);
          }

          // Send speed update to content script with source information
          chrome.tabs.sendMessage(tabId, {
            type: "UPDATE_SPEED",
            speed: speed,
            source: speedSource,
          });
        }
      );
    }, 500); // 500ms delay to ensure page is ready
  }
});

// Listen for any changes in the stored speed and notify all tabs (except pinned ones)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.selectedSpeed) {
    const newSpeed = changes.selectedSpeed.newValue
      ? parseFloat(changes.selectedSpeed.newValue)
      : 1;
    console.log(
      `[SpeedyVideo Background] Storage changed - new speed: ${newSpeed}. Notifying non-pinned tabs.`
    );
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        // Process only if the tab has a valid id and a URL that starts with http:// or https://
        if (
          tab.id !== undefined &&
          tab.url &&
          (tab.url.startsWith("http://") || tab.url.startsWith("https://"))
        ) {
          // Check if this tab has a pinned speed or domain rule - if so, don't update it
          chrome.storage.local.get(
            [`pinnedSpeed_${tab.id}`, "domainSpeeds", "blacklistDomains"],
            (result) => {
              if (result[`pinnedSpeed_${tab.id}`] !== undefined) {
                console.log(
                  `[SpeedyVideo Background] Skipping tab ID: ${tab.id} - has pinned speed`
                );
                return; // This tab has a pinned speed, don't update it
              }

              // Check if this tab has an active domain rule or is blacklisted
              const hostname = new URL(tab.url!).hostname.toLowerCase();

              // Check blacklist first
              if (
                isHostnameBlacklisted(result.blacklistDomains || [], hostname)
              ) {
                console.log(
                  `[SpeedyVideo Background] Skipping tab ID: ${tab.id} - domain ${hostname} is blacklisted`
                );
                return; // This domain is blacklisted, don't update it
              }

              const domainRule = findDomainRuleForHostname(
                result.domainSpeeds || [],
                hostname
              );

              if (domainRule) {
                console.log(
                  `[SpeedyVideo Background] Skipping tab ID: ${tab.id} - has active domain rule (${domainRule.speed}x for ${hostname})`
                );
                return; // This tab has an active domain rule, don't update it with global speed
              }

              console.log(
                `[SpeedyVideo Background] Sending global speed update to tab ID: ${tab.id} (URL: ${tab.url})`
              );
              chrome.tabs.sendMessage(
                tab.id!,
                { type: "UPDATE_SPEED", speed: newSpeed },
                () => {
                  if (chrome.runtime.lastError) {
                    const errorMessage = chrome.runtime.lastError.message ?? "";
                    if (
                      !errorMessage.includes("Receiving end does not exist") &&
                      !errorMessage.includes(
                        "The message port closed before a response was received"
                      )
                    ) {
                      console.error(
                        `[SpeedyVideo Background] Error sending message to tab ${tab.id}:`,
                        errorMessage
                      );
                    }
                  } else {
                    console.log(
                      `[SpeedyVideo Background] Message sent to tab ${tab.id} successfully.`
                    );
                  }
                }
              );
            }
          );
        }
      });
    });
  }
});

// Remove tab-specific data when a tab is closed
chrome.tabs.onRemoved.addListener((tabId, _removeInfo) => {
  const pinnedKey = `pinnedSpeed_${tabId}`;
  const activeDomainRuleKey = `activeDomainRule_${tabId}`;
  chrome.storage.local.remove([pinnedKey, activeDomainRuleKey], () => {
    if (chrome.runtime.lastError) {
      console.warn(
        `[SpeedyVideo Background] Error removing data for tab ${tabId}:`,
        chrome.runtime.lastError.message
      );
    } else {
      console.log(
        `[SpeedyVideo Background] Removed data for closed tab ${tabId}.`
      );
    }
  });
});

// Enhanced cleanup on browser startup
chrome.runtime.onStartup.addListener(() => {
  console.log("[SpeedyVideo Background] Browser started, performing cleanup.");
  setTimeout(() => {
    cleanupOrphanedPinnedSpeeds();
  }, 2000); // Wait 2 seconds for browser to stabilize
});
