// Log when the background service is installed or restarted
chrome.runtime.onInstalled.addListener(() => {
  console.log("[SpeedyVideo Background] Service worker installed.");
});

// When a tab is updated and finished loading, get the saved speed and send a message
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Process only if the tab URL starts with http:// or https://
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    (tab.url.startsWith("http://") || tab.url.startsWith("https://"))
  ) {
    chrome.storage.local.get(["selectedSpeed"], (result) => {
      const speed = result.selectedSpeed ? parseFloat(result.selectedSpeed) : 1;
      console.log(
        `[SpeedyVideo Background] Tab updated - ID: ${tabId}, URL: ${tab.url}, attempting to set speed to ${speed}`
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
    });
  }
});

// Listen for any changes in the stored speed and notify all tabs
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.selectedSpeed) {
    const newSpeed = changes.selectedSpeed.newValue
      ? parseFloat(changes.selectedSpeed.newValue)
      : 1;
    console.log(
      `[SpeedyVideo Background] Storage changed - new speed: ${newSpeed}. Notifying tabs.`
    );
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        // Process only if the tab has a valid id and a URL that starts with http:// or https://
        if (
          tab.id !== undefined &&
          tab.url &&
          (tab.url.startsWith("http://") || tab.url.startsWith("https://"))
        ) {
          console.log(
            `[SpeedyVideo Background] Sending speed update to tab ID: ${tab.id} (URL: ${tab.url})`
          );
          chrome.tabs.sendMessage(
            tab.id,
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
        }
      });
    });
  }
});
