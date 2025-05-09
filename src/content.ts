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

chrome.storage.local.get(["selectedSpeed"], (result) => {
  const speed = result.selectedSpeed ? parseFloat(result.selectedSpeed) : 1;
  console.log(`[SpeedyVideo] Initializing with speed: ${speed}`);
  initializePlaybackRate(speed);
  observeMediaChanges(speed);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // _sender to indicate unused
  if (message.type === "UPDATE_SPEED") {
    const speed = message.speed ?? 1;
    console.log(
      `[SpeedyVideo] Received UPDATE_SPEED message with speed: ${speed}`
    );
    initializePlaybackRate(speed); // Apply to existing elements
    observeMediaChanges(speed); // Re-observe for new elements with the new speed
    sendResponse({ status: "speed updated", newSpeed: speed }); // Acknowledge the message
    return true; // Indicates that sendResponse will be called asynchronously
  }
  return false; // No message handled by this listener
});
