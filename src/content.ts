// Centralized Speed Manager for systematic speed control
const MEDIA_COMMAND_TYPE = "SPEEDYVIDEO_MEDIA_COMMAND";
const MEDIA_COMMAND_SOURCE = "speedyvideo";

type MediaCommand =
  | { command: "set-speed"; speed: number }
  | { command: "disable" };

function postMediaCommand(command: MediaCommand): void {
  window.postMessage(
    {
      type: MEDIA_COMMAND_TYPE,
      source: MEDIA_COMMAND_SOURCE,
      ...command,
    },
    "*",
  );
}

class SpeedManager {
  private currentSpeed: number = 1.0;
  private currentSource: string = "global";
  private isEnabled: boolean = true;
  private readonly sessionState: {
    lastAppliedSpeed: number;
    isDomainRuleActive: boolean;
  } = {
    lastAppliedSpeed: 1.0,
    isDomainRuleActive: false,
  };

  // Track elements we've already attached listeners to, avoiding duplicates
  private readonly watchedElements = new WeakSet<HTMLMediaElement>();
  // Guard flag to prevent re-entrancy when we ourselves change playbackRate
  private isApplyingSpeed: boolean = false;

  setSpeed(speed: number, source: string = "unknown") {
    this.currentSpeed = speed;
    this.currentSource = source;
    this.sessionState.lastAppliedSpeed = speed;
    if (this.isEnabled) {
      postMediaCommand({ command: "set-speed", speed });
      this.applyToAllMedia();
    } else {
      postMediaCommand({ command: "disable" });
    }
    // Only save essential state, no personal browsing data
    this.saveMinimalState();
  }

  getCurrentSpeed(): number {
    return this.currentSpeed;
  }

  getCurrentSource(): string {
    return this.currentSource;
  }

  setEnabled(enabled: boolean) {
    const wasEnabled = this.isEnabled;
    this.isEnabled = enabled;
    if (!enabled && wasEnabled) {
      // Only reset media to 1.0 on the FIRST disable call.
      // If already disabled, don't touch media — user may have set a native speed.
      this.resetAllMedia();
    }
  }

  private resetAllMedia() {
    const mediaElements = findAllMediaElements(document);
    postMediaCommand({ command: "disable" });
    this.isApplyingSpeed = true;
    mediaElements.forEach((media) => {
      media.playbackRate = 1.0;
    });
    this.isApplyingSpeed = false;
  }

  isSpeedEnabled(): boolean {
    return this.isEnabled;
  }

  setDomainRuleActive(active: boolean) {
    this.sessionState.isDomainRuleActive = active;
  }

  isDomainRuleCurrentlyActive(): boolean {
    return this.sessionState.isDomainRuleActive;
  }

  private applyToAllMedia() {
    if (!this.isEnabled) return;

    const mediaElements = findAllMediaElements(document);

    this.isApplyingSpeed = true;
    mediaElements.forEach((media) => {
      // Attach per-element listeners the first time we see this element
      if (!this.watchedElements.has(media)) {
        this.watchedElements.add(media);

        // Re-enforce speed if the site resets it (e.g. after src is set or player init)
        media.addEventListener("ratechange", () => {
          if (this.isApplyingSpeed) return; // we caused this change, ignore
          if (!this.isEnabled) return; // blacklisted / disabled, leave native controls alone
          if (media.playbackRate !== this.currentSpeed) {
            this.isApplyingSpeed = true;
            media.playbackRate = this.currentSpeed;
            this.isApplyingSpeed = false;
          }
        });

        // Re-apply speed after the browser resets playbackRate on metadata load
        media.addEventListener("loadedmetadata", () => {
          if (!this.isEnabled) return;
          if (media.playbackRate !== this.currentSpeed) {
            this.isApplyingSpeed = true;
            media.playbackRate = this.currentSpeed;
            this.isApplyingSpeed = false;
          }
        });
      }

      if (media.playbackRate !== this.currentSpeed) {
        media.playbackRate = this.currentSpeed;
      }
    });
    this.isApplyingSpeed = false;
  }

  private saveMinimalState() {
    // Only save essential non-personal data
    try {
      sessionStorage.setItem("sv_session_speed", this.currentSpeed.toString());
      sessionStorage.setItem("sv_session_source", this.currentSource);
    } catch (error) {
      // Fallback if sessionStorage is not available
    }
  }

  loadMinimalState() {
    try {
      const sessionSpeed = sessionStorage.getItem("sv_session_speed");
      const sessionSource = sessionStorage.getItem("sv_session_source");

      if (sessionSpeed && sessionSource) {
        this.currentSpeed = parseFloat(sessionSpeed);
        this.currentSource = sessionSource;
      }
    } catch (error) {}
  }

  // Clean up when tab is closed or navigated away
  cleanup() {
    try {
      sessionStorage.removeItem("sv_session_speed");
      sessionStorage.removeItem("sv_session_source");
    } catch (error) {
      // Silent cleanup failure - not critical
    }
  }
}

// Initialize the speed manager
const speedManager = new SpeedManager();

let mediaObserver: MutationObserver | null = null;
let intersectionObserver: IntersectionObserver | null = null;
let scrollTimeoutId: number | undefined;
let debounceTimerId: number | undefined;
let connectionRetryCount = 0;
const MAX_RETRY_COUNT = 3;
let extensionContextLost = false;
let lastVideoCount = 0;
let videoCheckInterval: number | undefined;
let urlCheckInterval: number | undefined;
let scrollHandler: (() => void) | null = null;

// Global error handler for unhandled extension context errors
window.addEventListener("error", (event) => {
  if (event.error?.message?.includes("Extension context invalidated")) {
    extensionContextLost = true;
    switchToStandaloneMode();
    event.preventDefault();
  }
});

// Function to switch to standalone mode when extension context is lost
function switchToStandaloneMode() {
  const fallbackSpeed = speedManager.getCurrentSpeed() || 1.0;
  initializePlaybackRate(fallbackSpeed, "standalone");
  observeMediaChanges(fallbackSpeed, "standalone");
}

// Global variable to track current URL and tab info
let currentUrl = window.location.href;
let currentTabId: number | null = null;

// Default exclusion patterns (similar to other extensions)
const DEFAULT_EXCLUSION_PATTERNS = [
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

// Helper function to check if current domain is blacklisted
function isCurrentDomainBlacklisted(blacklistDomains: any[]): boolean {
  if (!Array.isArray(blacklistDomains) || blacklistDomains.length === 0) {
    return false;
  }

  const currentHostname = window.location.hostname.toLowerCase();

  for (const item of blacklistDomains) {
    if (!item || typeof item.domain !== "string") continue;

    const blacklistedDomain = item.domain.toLowerCase();

    if (currentHostname === blacklistedDomain) {
      return true;
    }

    if (currentHostname.endsWith("." + blacklistedDomain)) {
      return true;
    }

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

// Helper function to check URL exclusions with domain rule priority
function shouldExcludeUrl(
  exclusionPatterns: string[],
  hasUserDomainRule: boolean = false,
): boolean {
  if (hasUserDomainRule) {
    return false;
  }

  const patterns = exclusionPatterns || DEFAULT_EXCLUSION_PATTERNS;
  const currentUrlLower = window.location.href.toLowerCase();

  for (const pattern of patterns) {
    if (pattern.startsWith("starts_")) {
      const urlPattern = pattern.substring(7).toLowerCase();
      if (currentUrlLower.startsWith(urlPattern)) {
        return true;
      }
    } else if (pattern.startsWith("contains_")) {
      const searchTerm = pattern.substring(9).toLowerCase();
      if (currentUrlLower.includes(searchTerm)) {
        return true;
      }
    } else if (pattern.startsWith("exact_")) {
      const exactUrl = pattern.substring(6).toLowerCase();
      if (currentUrlLower === exactUrl) {
        return true;
      }
    }
  }

  return false;
}

// Recursively find media elements, including in Shadow DOM
function findAllMediaElements(root: Document | ShadowRoot): HTMLMediaElement[] {
  const videoSelectors = [
    "video",
    "audio",
    'video[data-testid*="video"]',
    'div[data-click-id="media"] video',
    "shreddit-player video",
    '[data-adclicklocation*="media"] video',
  ].join(", ");

  let mediaElements: HTMLMediaElement[] = [];

  try {
    mediaElements = Array.from(
      root.querySelectorAll<HTMLMediaElement>(videoSelectors),
    );
  } catch (e) {
    // Silent failure
  }

  // Find shadow hosts in the current root and recurse
  const shadowHosts = root.querySelectorAll("*");
  shadowHosts.forEach((host) => {
    if (host.shadowRoot) {
      mediaElements = mediaElements.concat(
        findAllMediaElements(host.shadowRoot),
      );
    }
  });

  return mediaElements;
}

function initializePlaybackRate(
  speed: number,
  source: string = "global",
): void {
  if (!speedManager.isSpeedEnabled()) {
    // Still update internal state so the manager knows the intended speed,
    // but don't attach any DOM listeners or force playbackRate.
    speedManager.setSpeed(speed, source);
    return;
  }

  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    speedManager.setSpeed(speed, source);
  } else {
    // Apply immediately in case some media already exists at document_start
    speedManager.setSpeed(speed, source);
    // Re-apply once DOM is ready so late-injected elements are caught
    document.addEventListener(
      "DOMContentLoaded",
      () => speedManager.setSpeed(speed, source),
      { once: true },
    );
  }
}

// Shared cleanup for all active observers, intervals, and listeners
function cleanupAllObservers(): void {
  if (mediaObserver) {
    mediaObserver.disconnect();
    mediaObserver = null;
  }
  if (intersectionObserver) {
    intersectionObserver.disconnect();
    intersectionObserver = null;
  }
  if (videoCheckInterval) {
    clearInterval(videoCheckInterval);
    videoCheckInterval = undefined;
  }
  if (scrollTimeoutId) {
    clearTimeout(scrollTimeoutId);
    scrollTimeoutId = undefined;
  }
  if (debounceTimerId) {
    clearTimeout(debounceTimerId);
    debounceTimerId = undefined;
  }
  if (scrollHandler) {
    window.removeEventListener("scroll", scrollHandler);
    scrollHandler = null;
  }
}

function observeMediaChanges(speed: number, source: string = "global"): void {
  speedManager.setSpeed(speed, source);

  // Always tear down existing observers first
  cleanupAllObservers();

  if (!speedManager.isSpeedEnabled()) return;

  // Main mutation observer with reduced debounce for faster response
  mediaObserver = new MutationObserver(() => {
    clearTimeout(debounceTimerId);
    debounceTimerId = window.setTimeout(() => {
      speedManager.setSpeed(
        speedManager.getCurrentSpeed(),
        speedManager.getCurrentSource(),
      );
    }, 50);
  });

  // In iframes at document_start, document.body may not exist yet.
  // Wait for it before attaching the observer.
  function attachObserver() {
    if (document.body) {
      mediaObserver!.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["src", "autoplay", "preload"],
      });
    } else {
      // Body not ready (iframe at document_start) - retry when DOM is ready
      document.addEventListener(
        "DOMContentLoaded",
        () => {
          if (document.body && mediaObserver) {
            mediaObserver.observe(document.body, {
              childList: true,
              subtree: true,
              attributes: true,
              attributeFilter: ["src", "autoplay", "preload"],
            });
            // Re-apply speed to catch any media elements added before observer attached
            speedManager.setSpeed(
              speedManager.getCurrentSpeed(),
              speedManager.getCurrentSource(),
            );
          }
        },
        { once: true },
      );
    }
  }
  attachObserver();

  // Intersection observer for videos entering viewport
  intersectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.target instanceof HTMLVideoElement) {
          const video = entry.target;
          if (video.playbackRate !== speedManager.getCurrentSpeed()) {
            video.playbackRate = speedManager.getCurrentSpeed();
          }
        }
      });
    },
    {
      threshold: 0.1,
      rootMargin: "50px",
    },
  );

  // Observe all existing videos
  const existingVideos = document.querySelectorAll("video");
  existingVideos.forEach((video) => {
    intersectionObserver?.observe(video);
  });

  // Periodic check for infinite scroll sites
  const isInfiniteScroll = isInfiniteScrollSite();

  if (isInfiniteScroll) {
    videoCheckInterval = window.setInterval(() => {
      const videoSelectors = [
        "video",
        "audio",
        'video[data-testid*="video"]',
        'div[data-click-id="media"] video',
        "shreddit-player video",
        '[data-adclicklocation*="media"] video',
      ];

      const currentVideoCount = document.querySelectorAll(
        videoSelectors.join(", "),
      ).length;

      if (currentVideoCount !== lastVideoCount) {
        lastVideoCount = currentVideoCount;

        speedManager.setSpeed(
          speedManager.getCurrentSpeed(),
          speedManager.getCurrentSource(),
        );

        // Add new videos to intersection observer
        const newVideos = document.querySelectorAll("video");
        newVideos.forEach((video) => {
          if (intersectionObserver) {
            intersectionObserver.observe(video);
          }
        });
      }
    }, 1000);

    // Scroll event listener for immediate response on infinite-scroll sites
    scrollHandler = () => {
      clearTimeout(scrollTimeoutId);
      scrollTimeoutId = window.setTimeout(() => {
        speedManager.setSpeed(
          speedManager.getCurrentSpeed(),
          speedManager.getCurrentSource(),
        );
      }, 200);
    };
    window.addEventListener("scroll", scrollHandler, { passive: true });

    // Reddit-specific event listeners for better video detection
    if (window.location.hostname.toLowerCase().includes("reddit.com")) {
      document.addEventListener("reddit:media-loaded", () => {
        speedManager.setSpeed(
          speedManager.getCurrentSpeed(),
          speedManager.getCurrentSource(),
        );
      });

      const redditPostObserver = new MutationObserver(() => {
        clearTimeout(debounceTimerId);
        debounceTimerId = window.setTimeout(() => {
          speedManager.setSpeed(
            speedManager.getCurrentSpeed(),
            speedManager.getCurrentSource(),
          );
        }, 100);
      });

      const redditContainers = document.querySelectorAll(
        '[data-testid*="post"], shreddit-post, div[data-click-id*="background"]',
      );
      redditContainers.forEach((container) => {
        redditPostObserver.observe(container, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["data-testid", "data-click-id"],
        });
      });
    }
  }
}

// Helper function to detect infinite scroll sites
function isInfiniteScrollSite(): boolean {
  const hostname = window.location.hostname.toLowerCase();
  return (
    hostname.includes("reddit.com") ||
    hostname.includes("twitter.com") ||
    hostname.includes("x.com") ||
    hostname.includes("tiktok.com") ||
    hostname.includes("instagram.com") ||
    hostname.includes("facebook.com") ||
    hostname.includes("linkedin.com")
  );
}

// Simplified systematic speed determination (no persistent overrides)
function determineAndApplySpeed(
  result: any,
  tabId: number | null = null,
): { speed: number; source: string } {
  let speed = 1.0;
  let source = "global";

  // Priority 1: Extension disabled
  if (result.extensionState === false) {
    speedManager.setEnabled(false);
    return { speed: 1.0, source: "disabled" };
  }

  speedManager.setEnabled(true);

  // Priority 2: Blacklisted domain
  if (isCurrentDomainBlacklisted(result.blacklistDomains)) {
    speedManager.setEnabled(false);
    speedManager.setDomainRuleActive(false);
    return { speed: 1.0, source: "blacklisted" };
  }

  // Priority 3: Pinned speed (highest persistent priority)
  if (tabId && result[`pinnedSpeed_${tabId}`] !== undefined) {
    speed = parseFloat(result[`pinnedSpeed_${tabId}`]);
    source = "pinned";
    speedManager.setDomainRuleActive(false);
    return { speed, source };
  }

  // Priority 4: Domain rule (check if user disabled it for this tab)
  const hostname = window.location.hostname.toLowerCase();
  const domainRule = findDomainRuleForHostname(
    result.domainSpeeds || [],
    hostname,
  );

  const domainRuleDisabled = tabId && result[`domainRuleDisabled_${tabId}`];

  if (domainRule && !domainRuleDisabled) {
    speed = domainRule.speed;
    source = "domain";
    speedManager.setDomainRuleActive(true);
    return { speed, source };
  }

  // Priority 5: URL exclusions
  if (shouldExcludeUrl(result.websitesAddedToUrlConditionsExclusion, false)) {
    speedManager.setEnabled(false);
    speedManager.setDomainRuleActive(false);
    return { speed: 1.0, source: "excluded" };
  }

  // Priority 6: Global speed (fallback)
  speed = result.selectedSpeed ? parseFloat(result.selectedSpeed) : 1.0;
  speedManager.setDomainRuleActive(false);

  return { speed, source };
}

// On load, check extension state and only run logic if enabled
chrome.storage.local.get(
  [
    "extensionState",
    "selectedSpeed",
    "domainSpeeds",
    "websitesAddedToUrlConditionsExclusion",
    "blacklistDomains",
  ],
  (result) => {
    speedManager.loadMinimalState();

    safeRuntimeMessage({ type: "GET_CURRENT_TAB" }, (response) => {
      const tabId = response?.tabId || null;

      if (tabId) {
        currentTabId = tabId;
        chrome.storage.local.get(
          [`pinnedSpeed_${tabId}`, `domainRuleDisabled_${tabId}`],
          (tabResult) => {
            const combinedResult = { ...result, ...tabResult };
            const { speed, source } = determineAndApplySpeed(
              combinedResult,
              tabId,
            );

            initializePlaybackRate(speed, source);
            observeMediaChanges(speed, source);
          },
        );
      } else {
        const { speed, source } = determineAndApplySpeed(result);
        initializePlaybackRate(speed, source);
        observeMediaChanges(speed, source);
      }
    });

    setupUrlChangeListeners();

    window.addEventListener("beforeunload", () => {
      cleanupAllObservers();
      if (urlCheckInterval) {
        clearInterval(urlCheckInterval);
        urlCheckInterval = undefined;
      }
      speedManager.cleanup();
    });
  },
);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "UPDATE_SPEED") {
    chrome.storage.local.get(["extensionState"], (result) => {
      if (result.extensionState === false) {
        sendResponse({ status: "blocked - extension disabled" });
        return;
      }

      const speed = message.speed ?? 1;
      const source = message.source ?? "manual";

      speedManager.setSpeed(speed, source);
      initializePlaybackRate(speed, source);
      observeMediaChanges(speed, source);

      sendResponse({
        status: "speed updated",
        newSpeed: speed,
        source,
      });
    });
    return true;
  } else if (message.type === "GET_CURRENT_SPEED") {
    sendResponse({
      currentSpeed: speedManager.getCurrentSpeed(),
      source: speedManager.getCurrentSource(),
      isEnabled: speedManager.isSpeedEnabled(),
    });
    return true;
  } else if (message.type === "DISABLE_SPEEDYVIDEO") {
    speedManager.setEnabled(false);
    cleanupAllObservers();
    sendResponse({ status: "disabled" });
  } else if (message.type === "ENABLE_SPEEDYVIDEO") {
    getCurrentTabAndApplySpeed();
    sendResponse({ status: "enabled" });
    return true;
  } else if (message.type === "CLEANUP_LEGACY_DATA") {
    try {
      localStorage.removeItem("speedyVideoLastSpeed");
      localStorage.removeItem("speedyVideoLastSource");
    } catch (error) {}
    sendResponse({ status: "cleanup completed" });
  }

  return false;
});

// Helper function to safely send messages with retry
function safeRuntimeMessage(
  message: any,
  callback?: (response: any) => void,
  retryCount = 0,
) {
  if (extensionContextLost) {
    if (callback) callback(null);
    return;
  }

  try {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        if (
          chrome.runtime.lastError?.message?.includes(
            "Extension context invalidated",
          )
        ) {
          extensionContextLost = true;
          switchToStandaloneMode();
          if (callback) callback(null);
          return;
        }

        if (retryCount < MAX_RETRY_COUNT) {
          connectionRetryCount++;
          setTimeout(
            () => {
              safeRuntimeMessage(message, callback, retryCount + 1);
            },
            1000 * (retryCount + 1),
          );
          return;
        }

        if (callback) {
          callback(null);
        }
        return;
      }

      connectionRetryCount = 0;
      if (callback) {
        callback(response);
      }
    });
  } catch (error) {
    extensionContextLost = true;
    switchToStandaloneMode();
    if (callback) {
      callback(null);
    }
  }
}

// Helper function to find domain rule for hostname (same logic as popup)
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

    if (hostnameNormalized.endsWith("." + ruleNoWww)) {
      return rule;
    }
  }

  return null;
}

// Function to get and apply the correct speed for current tab
function getCurrentTabAndApplySpeed(): void {
  safeRuntimeMessage({ type: "GET_CURRENT_TAB" }, (response) => {
    if (!response) {
      chrome.storage.local.get(["selectedSpeed"], (result) => {
        const speed = (result.selectedSpeed as string)
          ? parseFloat(result.selectedSpeed as string)
          : 1.0;
        initializePlaybackRate(speed, "fallback");
        observeMediaChanges(speed, "fallback");
      });
      return;
    }

    if (response?.tabId) {
      currentTabId = response.tabId;

      chrome.storage.local.get(
        [
          "extensionState",
          `pinnedSpeed_${currentTabId}`,
          "selectedSpeed",
          "domainSpeeds",
          "blacklistDomains",
          "websitesAddedToUrlConditionsExclusion",
        ],
        (result) => {
          const { speed, source } = determineAndApplySpeed(
            result,
            currentTabId,
          );
          initializePlaybackRate(speed, source);
          observeMediaChanges(speed, source);
        },
      );
    }
  });
}

// Function to handle URL changes in SPAs
function handleUrlChange(): void {
  const newUrl = window.location.href;
  if (newUrl !== currentUrl) {
    currentUrl = newUrl;
    getCurrentTabAndApplySpeed();
  }
}

// Listen for URL changes using various methods
function setupUrlChangeListeners(): void {
  window.addEventListener("popstate", handleUrlChange);

  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  history.pushState = function (
    data: any,
    title: string,
    url?: string | URL | null,
  ) {
    originalPushState.call(history, data, title, url);
    setTimeout(handleUrlChange, 100);
  };

  history.replaceState = function (
    data: any,
    title: string,
    url?: string | URL | null,
  ) {
    originalReplaceState.call(history, data, title, url);
    setTimeout(handleUrlChange, 100);
  };

  // Periodic check as fallback (tracked for cleanup)
  urlCheckInterval = window.setInterval(handleUrlChange, 2000);
}

setupUrlChangeListeners();
