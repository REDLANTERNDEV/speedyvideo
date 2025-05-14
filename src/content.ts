let mediaObserver: MutationObserver | null = null;
let debounceTimerId: number | undefined; // For debouncing MutationObserver callbacks

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
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  chrome.storage.local.get(["extensionState"], (result) => {
    if (result.extensionState === false && message.type === "UPDATE_SPEED") {
      // Block speed update if globally disabled
      return false;
    }
    if (message.type === "UPDATE_SPEED") {
      const speed = message.speed ?? 1;
      console.log(
        `[SpeedyVideo] Received UPDATE_SPEED message with speed: ${speed}`
      );
      initializePlaybackRate(speed); // Apply to existing elements
      observeMediaChanges(speed); // Re-observe for new elements with the new speed
      sendResponse({ status: "speed updated", newSpeed: speed });
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
    } else if (message.type === "ENABLE_SPEEDYVIDEO") {
      chrome.storage.local.get(["selectedSpeed"], (result) => {
        const speed = result.selectedSpeed
          ? parseFloat(result.selectedSpeed)
          : 1.0;
        initializePlaybackRate(speed);
        observeMediaChanges(speed);
        console.log("[SpeedyVideo] Extension enabled on this tab.");
      });
    }
    return false; // No message handled by this listener
  });
});
