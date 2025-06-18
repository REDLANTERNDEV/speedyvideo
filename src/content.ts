let mediaObserver: MutationObserver | null = null;
let debounceTimerId: number | undefined; // For debouncing MutationObserver callbacks

// Global variable to track current URL and tab info
let currentUrl = window.location.href;
let currentTabId: number | null = null;

function updateMediaPlaybackRate(speed: number): void {
  const mediaElements =
    document.querySelectorAll<HTMLMediaElement>("video, audio");
  mediaElements.forEach((media) => {
    if (media.playbackRate !== speed) {
      // Only update if different
      media.playbackRate = speed;
    }
  });
  if (mediaElements.length > 0) {
    console.log(
      `[SpeedyVideo] Set playback rate to ${speed} on ${mediaElements.length} media elements (direct update)`
    );
  }
}

function initializePlaybackRate(speed: number): void {
  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    // also check for interactive
    updateMediaPlaybackRate(speed);
  } else {
    document.addEventListener("DOMContentLoaded", () =>
      updateMediaPlaybackRate(speed)
    );
  }
}

function observeMediaChanges(speed: number): void {
  if (mediaObserver) {
    mediaObserver.disconnect();
  }
  mediaObserver = new MutationObserver(() => {
    clearTimeout(debounceTimerId);
    debounceTimerId = window.setTimeout(() => {
      const mediaElements =
        document.querySelectorAll<HTMLMediaElement>("video, audio");
      let updatedCount = 0;
      mediaElements.forEach((media) => {
        if (media.playbackRate !== speed) {
          media.playbackRate = speed;
          updatedCount++;
        }
      });
      if (updatedCount > 0) {
        console.log(
          `[SpeedyVideo] Updated ${updatedCount} media element(s) to speed ${speed} (observer)`
        );
      }
    }, 100); // Debounce for 100ms
  });
  mediaObserver.observe(document.body, { childList: true, subtree: true });
}

// On load, check extension state and only run logic if enabled
chrome.storage.local.get(["extensionState", "selectedSpeed"], (result) => {
  if (result.extensionState === false) {
    // Extension is disabled, do not run logic
    console.log(
      "[SpeedyVideo] Extension is globally disabled. No logic will run."
    );
    return;
  }
  const speed = result.selectedSpeed ? parseFloat(result.selectedSpeed) : 1;
  console.log(`[SpeedyVideo] Initializing with speed: ${speed}`);
  initializePlaybackRate(speed);
  observeMediaChanges(speed);

  // Setup URL change listeners for SPAs
  setupUrlChangeListeners();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "UPDATE_SPEED") {
    // Always check current extension state before applying speed changes
    chrome.storage.local.get(["extensionState"], (result) => {
      if (result.extensionState === false) {
        // Block speed update if globally disabled
        console.log(
          "[SpeedyVideo] Speed update blocked - extension is disabled"
        );
        sendResponse({ status: "blocked - extension disabled" });
        return;
      }

      const speed = message.speed ?? 1;
      console.log(
        `[SpeedyVideo] Received UPDATE_SPEED message with speed: ${speed}`
      );
      initializePlaybackRate(speed); // Apply to existing elements
      observeMediaChanges(speed); // Re-observe for new elements with the new speed
      sendResponse({ status: "speed updated", newSpeed: speed });
    });
    return true; // Indicates that sendResponse will be called asynchronously
  } else if (message.type === "DISABLE_SPEEDYVIDEO") {
    // Set all media elements to default speed and stop observing
    const defaultSpeed = 1.0;
    initializePlaybackRate(defaultSpeed);
    if (mediaObserver) {
      mediaObserver.disconnect();
      mediaObserver = null;
    }
    console.log("[SpeedyVideo] Extension disabled on this tab.");
    sendResponse({ status: "disabled" });
  } else if (message.type === "ENABLE_SPEEDYVIDEO") {
    // Get current tab ID and check for pinned speed first
    getCurrentTabAndApplySpeed();
    sendResponse({ status: "enabled" });
    return true;
  }

  return false; // No message handled by this listener
});

// Function to get and apply the correct speed for current tab
function getCurrentTabAndApplySpeed(): void {
  // Get current tab ID from chrome API
  chrome.runtime.sendMessage({ type: "GET_CURRENT_TAB" }, (response) => {
    if (response?.tabId) {
      currentTabId = response.tabId;

      // Check for pinned speed first, then global speed
      chrome.storage.local.get(
        ["extensionState", `pinnedSpeed_${currentTabId}`, "selectedSpeed"],
        (result) => {
          if (result.extensionState === false) {
            console.log(
              "[SpeedyVideo] Extension is disabled, setting speed to 1.0"
            );
            initializePlaybackRate(1.0);
            return;
          }

          let speed: number;
          let speedSource: string;

          if (result[`pinnedSpeed_${currentTabId}`] !== undefined) {
            speed = parseFloat(result[`pinnedSpeed_${currentTabId}`]);
            speedSource = "pinned";
          } else {
            speed = result.selectedSpeed
              ? parseFloat(result.selectedSpeed)
              : 1.0;
            speedSource = "global";
          }

          console.log(
            `[SpeedyVideo] URL changed - applying ${speedSource} speed: ${speed}`
          );
          initializePlaybackRate(speed);
          observeMediaChanges(speed);
        }
      );
    }
  });
}

// Function to handle URL changes in SPAs
function handleUrlChange(): void {
  const newUrl = window.location.href;
  if (newUrl !== currentUrl) {
    console.log(`[SpeedyVideo] URL changed from ${currentUrl} to ${newUrl}`);
    currentUrl = newUrl;

    // Delay to let the page load new content
    setTimeout(() => {
      getCurrentTabAndApplySpeed();
    }, 500);
  }
}

// Listen for URL changes using various methods
function setupUrlChangeListeners(): void {
  // Method 1: Listen for popstate (back/forward navigation)
  window.addEventListener("popstate", handleUrlChange);

  // Method 2: Listen for pushstate and replacestate (programmatic navigation)
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  history.pushState = function (
    data: any,
    title: string,
    url?: string | URL | null
  ) {
    originalPushState.call(history, data, title, url);
    setTimeout(handleUrlChange, 100);
  };

  history.replaceState = function (
    data: any,
    title: string,
    url?: string | URL | null
  ) {
    originalReplaceState.call(history, data, title, url);
    setTimeout(handleUrlChange, 100);
  };

  // Method 3: Periodic check as fallback
  setInterval(handleUrlChange, 2000);
}

// Start observing URL changes
setupUrlChangeListeners();
