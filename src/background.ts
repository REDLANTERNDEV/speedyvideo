// Log when the background service is installed or restarted
chrome.runtime.onInstalled.addListener(() => {
  console.log("[SpeedyVideo Background] Service worker installed.");
});

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

// When a tab is updated and finished loading, get the saved speed and send a message
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Process only if the tab URL starts with http:// or https://
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    (tab.url.startsWith("http://") || tab.url.startsWith("https://"))
  ) {
    chrome.storage.local.get(
      ["extensionState", "selectedSpeed", `pinnedSpeed_${tabId}`],
      (result) => {
        if (result.extensionState === false) {
          chrome.tabs.sendMessage(tabId, { type: "DISABLE_SPEEDYVIDEO" });
        } else {
          // Check if this tab has a pinned speed first
          let speed: number;
          let speedSource: string;

          if (result[`pinnedSpeed_${tabId}`] !== undefined) {
            speed = parseFloat(result[`pinnedSpeed_${tabId}`]);
            speedSource = "pinned";
          } else {
            speed = result.selectedSpeed ? parseFloat(result.selectedSpeed) : 1;
            speedSource = "global";
          }

          console.log(
            `[SpeedyVideo Background] Tab updated - ID: ${tabId}, URL: ${tab.url}, applying ${speedSource} speed: ${speed}`
          );
          chrome.tabs.sendMessage(
            tabId,
            { type: "UPDATE_SPEED", speed },
            (response) => {
              if (chrome.runtime.lastError) {
                const errorMessage = chrome.runtime.lastError.message ?? "";
                // Ignore error messages for cases when no receiver exists
                // or when the message port closed before a response was received.
                if (
                  !errorMessage.includes("Receiving end does not exist") &&
                  !errorMessage.includes(
                    "The message port closed before a response was received"
                  )
                ) {
                  console.error(
                    `[SpeedyVideo Background] Error sending message to tab ${tabId}:`,
                    errorMessage
                  );
                }
              } else {
                console.log(
                  `[SpeedyVideo Background] Message sent to tab ${tabId} successfully. Response:`,
                  response
                );
              }
            }
          );
        }
      }
    );
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
          // Check if this tab has a pinned speed - if so, don't update it
          chrome.storage.local.get([`pinnedSpeed_${tab.id}`], (result) => {
            if (result[`pinnedSpeed_${tab.id}`] !== undefined) {
              console.log(
                `[SpeedyVideo Background] Skipping tab ID: ${tab.id} - has pinned speed`
              );
              return; // This tab has a pinned speed, don't update it
            }
            console.log(
              `[SpeedyVideo Background] Sending global speed update to tab ID: ${tab.id} (URL: ${tab.url})`
            );
            chrome.tabs.sendMessage(
              tab.id!,
              { type: "UPDATE_SPEED", speed: newSpeed },
              (response) => {
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
                    `[SpeedyVideo Background] Message sent to tab ${tab.id} successfully. Response:`,
                    response
                  );
                }
              }
            );
          });
        }
      });
    });
  }
});

// Remove pinned speed when a tab is closed
chrome.tabs.onRemoved.addListener((tabId, _removeInfo) => {
  const key = `pinnedSpeed_${tabId}`;
  chrome.storage.local.remove([key], () => {
    if (chrome.runtime.lastError) {
      console.warn(
        `[SpeedyVideo Background] Error removing ${key}:`,
        chrome.runtime.lastError.message
      );
    } else {
      console.log(
        `[SpeedyVideo Background] Removed ${key} from storage (tab closed).`
      );
    }
  });
});
