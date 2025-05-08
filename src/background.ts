// Log when the background service is installed or restarted
chrome.runtime.onInstalled.addListener(() => {
  console.log("Background service worker installed.");
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
        `Tab updated - ID: ${tabId}, URL: ${tab.url}, setting speed to ${speed}`
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
              console.error("Error sending message to tab:", errorMessage);
            }
          } else {
            console.log("Message sent to tab successfully.", response);
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
    console.log(`Storage changed - new speed: ${newSpeed}`);
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        // Process only if the tab has a valid id and a URL that starts with http:// or https://
        if (
          tab.id !== undefined &&
          tab.url &&
          (tab.url.startsWith("http://") || tab.url.startsWith("https://"))
        ) {
          console.log(`Sending speed update to tab ID: ${tab.id}`);
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
                    `Error sending message to tab ${tab.id}:`,
                    errorMessage
                  );
                }
              } else {
                console.log(
                  `Message sent to tab ${tab.id} successfully.`,
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
