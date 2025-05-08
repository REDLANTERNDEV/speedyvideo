let mediaObserver: MutationObserver | null = null;

function updateMediaPlaybackRate(speed: number): void {
  const mediaElements =
    document.querySelectorAll<HTMLMediaElement>("video, audio");
  mediaElements.forEach((media) => (media.playbackRate = speed));
  console.log(
    `Set playback rate to ${speed} on ${mediaElements.length} media elements`
  );
}

function initializePlaybackRate(speed: number): void {
  if (document.readyState === "complete") {
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
    let debounceTimer: number | undefined;
    if (debounceTimer) clearTimeout(debounceTimer);
    window.setTimeout(() => {
      const mediaElements =
        document.querySelectorAll<HTMLMediaElement>("video, audio");
      mediaElements.forEach((media) => {
        if (media.playbackRate !== speed) {
          media.playbackRate = speed;
          console.log(`Updated media element to speed ${speed}`);
        }
      });
    }, 100);
  });
  mediaObserver.observe(document.body, { childList: true, subtree: true });
}

chrome.storage.local.get(["selectedSpeed"], (result) => {
  const speed = result.selectedSpeed ? parseFloat(result.selectedSpeed) : 1;
  initializePlaybackRate(speed);
  observeMediaChanges(speed);
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "UPDATE_SPEED") {
    const speed = message.speed ?? 1;
    initializePlaybackRate(speed);
    observeMediaChanges(speed);
  }
});
