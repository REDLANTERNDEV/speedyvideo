// Centralized Speed Manager for systematic speed control
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

  setSpeed(speed: number, source: string = "unknown") {
    this.currentSpeed = speed;
    this.currentSource = source;
    this.sessionState.lastAppliedSpeed = speed;
    this.applyToAllMedia();
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
    this.isEnabled = enabled;
    if (!enabled) {
      this.setSpeed(1.0, "disabled");
    }
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
    const mediaElements = findAllMediaElements(document);
    let updatedCount = 0;

    mediaElements.forEach((media) => {
      if (media.playbackRate !== this.currentSpeed) {
        media.playbackRate = this.currentSpeed;
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
    }
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
} // Initialize the speed manager
const speedManager = new SpeedManager();

let mediaObserver: MutationObserver | null = null;
let intersectionObserver: IntersectionObserver | null = null;
let scrollTimeoutId: number | undefined;
let debounceTimerId: number | undefined; // For debouncing MutationObserver callbacks
let connectionRetryCount = 0;
const MAX_RETRY_COUNT = 3;
let extensionContextLost = false; // Track if extension context is lost
let lastVideoCount = 0; // Track video count changes
let videoCheckInterval: number | undefined; // For periodic video checks

// Global error handler for unhandled extension context errors
window.addEventListener("error", (event) => {
  if (event.error?.message?.includes("Extension context invalidated")) {
    // Removed console statement
    extensionContextLost = true;
    // Switch to standalone mode
    switchToStandaloneMode();
    event.preventDefault(); // Prevent the error from being logged
  }
});

// Function to switch to standalone mode when extension context is lost
function switchToStandaloneMode() {
  // Removed console statement

  // Use session fallback or default speed
  const fallbackSpeed = speedManager.getCurrentSpeed() || 1.0;

  // Removed console statement
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

// Helper function to check URL exclusions with domain rule priority
function shouldExcludeUrl(
  exclusionPatterns: string[],
  hasUserDomainRule: boolean = false
): boolean {
  // If user has set a custom domain rule, don't exclude
  if (hasUserDomainRule) {
    // Removed console statement
    return false;
  }

  const patterns = exclusionPatterns || DEFAULT_EXCLUSION_PATTERNS;
  const currentUrlLower = window.location.href.toLowerCase();

  for (const pattern of patterns) {
    if (pattern.startsWith("starts_")) {
      const urlPattern = pattern.substring(7).toLowerCase();
      if (currentUrlLower.startsWith(urlPattern)) {
        // Removed console statement
        return true;
      }
    } else if (pattern.startsWith("contains_")) {
      const searchTerm = pattern.substring(9).toLowerCase();
      if (currentUrlLower.includes(searchTerm)) {
        // Removed console statement
        return true;
      }
    } else if (pattern.startsWith("exact_")) {
      const exactUrl = pattern.substring(6).toLowerCase();
      if (currentUrlLower === exactUrl) {
        // Removed console statement
        return true;
      }
    }
  }

  return false;
}

// New function to recursively find media elements, including in Shadow DOM
function findAllMediaElements(root: Document | ShadowRoot): HTMLMediaElement[] {
  const videoSelectors = [
    "video",
    "audio",
    'video[data-testid*="video"]', // Reddit video elements
    'div[data-click-id="media"] video', // Reddit media containers
    "shreddit-player video", // Reddit's custom player
    '[data-adclicklocation*="media"] video', // Reddit ad videos
  ].join(", ");

  let mediaElements: HTMLMediaElement[] = [];

  // Find media in the current root
  try {
    mediaElements = Array.from(
      root.querySelectorAll<HTMLMediaElement>(videoSelectors)
    );
  } catch (e) {
    // Removed console statement
  }

  // Find shadow hosts in the current root and recurse
  const shadowHosts = root.querySelectorAll("*");
  shadowHosts.forEach((host) => {
    if (host.shadowRoot) {
      mediaElements = mediaElements.concat(
        findAllMediaElements(host.shadowRoot)
      );
    }
  });

  return mediaElements;
}

function initializePlaybackRate(
  speed: number,
  source: string = "global"
): void {
  speedManager.setSpeed(speed, source);

  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    speedManager.setSpeed(speed, source);
  } else {
    document.addEventListener("DOMContentLoaded", () =>
      speedManager.setSpeed(speed, source)
    );
  }
}

function observeMediaChanges(speed: number, source: string = "global"): void {
  speedManager.setSpeed(speed, source);

  if (mediaObserver) {
    mediaObserver.disconnect();
  }
  if (intersectionObserver) {
    intersectionObserver.disconnect();
  }
  if (videoCheckInterval) {
    clearInterval(videoCheckInterval);
  }

  // Main mutation observer with reduced debounce for faster response
  mediaObserver = new MutationObserver(() => {
    clearTimeout(debounceTimerId);
    debounceTimerId = window.setTimeout(() => {
      speedManager.setSpeed(
        speedManager.getCurrentSpeed(),
        speedManager.getCurrentSource()
      );
    }, 50);
  });
  mediaObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src", "autoplay", "preload"],
  });

  // Intersection observer for videos entering viewport
  intersectionObserver = new IntersectionObserver(
    (entries) => {
      let hasNewVideos = false;
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.target instanceof HTMLVideoElement) {
          const video = entry.target;
          if (video.playbackRate !== speedManager.getCurrentSpeed()) {
            video.playbackRate = speedManager.getCurrentSpeed();
            hasNewVideos = true;
          }
        }
      });

      if (hasNewVideos) {
      }
    },
    {
      threshold: 0.1, // Trigger when 10% of video is visible
      rootMargin: "50px", // Start observing 50px before video enters viewport
    }
  );

  // Observe all existing videos
  const existingVideos = document.querySelectorAll("video");
  existingVideos.forEach((video) => {
    intersectionObserver?.observe(video);
  });

  // Periodic check for Reddit and other infinite scroll sites
  if (isInfiniteScrollSite()) {
    videoCheckInterval = window.setInterval(() => {
      // Enhanced video detection for Reddit
      const videoSelectors = [
        "video",
        "audio",
        'video[data-testid*="video"]',
        'div[data-click-id="media"] video',
        "shreddit-player video",
        '[data-adclicklocation*="media"] video',
      ];

      const currentVideoCount = document.querySelectorAll(
        videoSelectors.join(", ")
      ).length;

      if (currentVideoCount !== lastVideoCount) {
        // Removed console statement
        speedManager.setSpeed(
          speedManager.getCurrentSpeed(),
          speedManager.getCurrentSource()
        );

        // Add new videos to intersection observer
        const newVideos = document.querySelectorAll("video");
        newVideos.forEach((video) => {
          if (intersectionObserver) {
            intersectionObserver.observe(video);
          }
        });
      }
    }, 1000); // Check every second for new videos
  }

  // Scroll event listener for immediate response on Reddit-like sites
  if (isInfiniteScrollSite()) {
    const handleScroll = () => {
      clearTimeout(scrollTimeoutId);
      scrollTimeoutId = window.setTimeout(() => {
        speedManager.setSpeed(
          speedManager.getCurrentSpeed(),
          speedManager.getCurrentSource()
        );
      }, 200);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    // Reddit-specific event listeners for better video detection
    if (window.location.hostname.toLowerCase().includes("reddit.com")) {
      // Listen for Reddit's custom events if available
      document.addEventListener("reddit:media-loaded", () => {
        // Removed console statement
        speedManager.setSpeed(
          speedManager.getCurrentSpeed(),
          speedManager.getCurrentSource()
        );
      });

      // Listen for changes to Reddit's post containers
      const redditPostObserver = new MutationObserver(() => {
        clearTimeout(debounceTimerId);
        debounceTimerId = window.setTimeout(() => {
          speedManager.setSpeed(
            speedManager.getCurrentSpeed(),
            speedManager.getCurrentSource()
          );
        }, 100);
      });

      // Observe Reddit-specific containers
      const redditContainers = document.querySelectorAll(
        '[data-testid*="post"], shreddit-post, div[data-click-id*="background"]'
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
  tabId: number | null = null
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
    // Removed console statement
    speedManager.setDomainRuleActive(false);
    return { speed: 1.0, source: "blacklisted" };
  }

  // Priority 3: Pinned speed (highest persistent priority)
  if (tabId && result[`pinnedSpeed_${tabId}`] !== undefined) {
    speed = parseFloat(result[`pinnedSpeed_${tabId}`]);
    source = "pinned";
    // Removed console statement
    speedManager.setDomainRuleActive(false);
    return { speed, source };
  }

  // Priority 4: Domain rule (check if user disabled it for this tab)
  const hostname = window.location.hostname.toLowerCase();
  const domainRule = findDomainRuleForHostname(
    result.domainSpeeds || [],
    hostname
  );

  // Check if user has disabled domain rule for this specific tab
  const domainRuleDisabled = tabId && result[`domainRuleDisabled_${tabId}`];

  if (domainRule && !domainRuleDisabled) {
    speed = domainRule.speed;
    source = "domain";
    // Removed console statement
    speedManager.setDomainRuleActive(true);
    return { speed, source };
  }

  // Priority 5: URL exclusions
  if (shouldExcludeUrl(result.websitesAddedToUrlConditionsExclusion, false)) {
    // Removed console statement
    speedManager.setDomainRuleActive(false);
    return { speed: 1.0, source: "excluded" };
  }

  // Priority 6: Global speed (fallback)
  speed = result.selectedSpeed ? parseFloat(result.selectedSpeed) : 1.0;
  // Removed console statement
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

    // Get current tab ID and apply appropriate speed
    safeRuntimeMessage({ type: "GET_CURRENT_TAB" }, (response) => {
      const tabId = response?.tabId || null;

      if (tabId) {
        currentTabId = tabId;
        // Get tab-specific data (pinned speeds and domain rule disabled status)
        chrome.storage.local.get(
          [`pinnedSpeed_${tabId}`, `domainRuleDisabled_${tabId}`],
          (tabResult) => {
            const combinedResult = { ...result, ...tabResult };
            const { speed, source } = determineAndApplySpeed(
              combinedResult,
              tabId
            );

            initializePlaybackRate(speed, source);
            observeMediaChanges(speed, source);
          }
        );
      } else {
        // Fallback without tab-specific features
        const { speed, source } = determineAndApplySpeed(result);
        initializePlaybackRate(speed, source);
        observeMediaChanges(speed, source);
      }
    });

    // Setup URL change listeners for SPAs
    setupUrlChangeListeners();

    // Cleanup on page unload
    window.addEventListener("beforeunload", () => {
      speedManager.cleanup();
    });
  }
);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "UPDATE_SPEED") {
    // Always check current extension state before applying speed changes
    chrome.storage.local.get(["extensionState"], (result) => {
      if (result.extensionState === false) {
        // Block speed update if globally disabled
        // Removed console statement
        sendResponse({ status: "blocked - extension disabled" });
        return;
      }

      const speed = message.speed ?? 1;
      const source = message.source ?? "manual";

      // Apply the speed directly - domain rule updates are handled by popup/SpeedButtons
      // Removed console statement

      // Update the current speed state
      speedManager.setSpeed(speed, source);

      // Apply to media elements
      initializePlaybackRate(speed, source);
      observeMediaChanges(speed, source);

      sendResponse({
        status: "speed updated",
        newSpeed: speed,
        source,
      });
    });
    return true; // Indicates that sendResponse will be called asynchronously
  } else if (message.type === "GET_CURRENT_SPEED") {
    sendResponse({
      currentSpeed: speedManager.getCurrentSpeed(),
      source: speedManager.getCurrentSource(),
      isEnabled: speedManager.isSpeedEnabled(),
    });
    return true;
  } else if (message.type === "DISABLE_SPEEDYVIDEO") {
    speedManager.setEnabled(false);

    // Clean up all observers and intervals
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

    // Removed console statement
    sendResponse({ status: "disabled" });
  } else if (message.type === "ENABLE_SPEEDYVIDEO") {
    // Get current tab ID and check for pinned speed first
    getCurrentTabAndApplySpeed();
    sendResponse({ status: "enabled" });
    return true;
  } else if (message.type === "CLEANUP_LEGACY_DATA") {
    // Clean up old localStorage entries for privacy
    try {
      localStorage.removeItem("speedyVideoLastSpeed");
      localStorage.removeItem("speedyVideoLastSource");
    } catch (error) {}
    sendResponse({ status: "cleanup completed" });
  }

  return false; // No message handled by this listener
});

// Helper function to safely send messages with retry
function safeRuntimeMessage(
  message: any,
  callback?: (response: any) => void,
  retryCount = 0
) {
  // If extension context is lost, immediately use fallback
  if (extensionContextLost) {
    // Removed console statement
    if (callback) callback(null);
    return;
  }

  try {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        // Check if this is a context invalidation error
        if (
          chrome.runtime.lastError?.message?.includes(
            "Extension context invalidated"
          )
        ) {
          extensionContextLost = true;
          switchToStandaloneMode();
          if (callback) callback(null);
          return;
        }

        if (retryCount < MAX_RETRY_COUNT) {
          connectionRetryCount++; // Track retry attempts
          // Retry after a short delay
          setTimeout(() => {
            safeRuntimeMessage(message, callback, retryCount + 1);
          }, 1000 * (retryCount + 1)); // Exponential backoff
          return;
        }

        // If retries exhausted, use fallback
        if (callback) {
          callback(null);
        }
        return;
      }

      connectionRetryCount = 0; // Reset on success
      if (callback) {
        callback(response);
      }
    });
  } catch (error) {
    // Removed console statement
    // Any error here likely means extension context is invalid
    extensionContextLost = true;
    switchToStandaloneMode();
    if (callback) {
      callback(null);
    }
  }
}

// Helper function to find domain rule for hostname (same logic as popup)
function findDomainRuleForHostname(domainSpeeds: any[], hostname: string) {
  // Removed console statement

  if (!Array.isArray(domainSpeeds) || domainSpeeds.length === 0) {
    // Removed console statement
    return null;
  }

  const hostnameNormalized = hostname.toLowerCase();
  // Removed console statement

  // Try exact match first
  for (const rule of domainSpeeds) {
    const ruleHostname = rule.domain.toLowerCase();
    // Removed console statement
    if (hostnameNormalized === ruleHostname) {
      // Removed console statement
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

    // Removed console statement

    if (hostnameNoWww === ruleNoWww) {
      // Removed console statement
      return rule;
    }

    // Check subdomain
    if (hostnameNormalized.endsWith("." + ruleNoWww)) {
      // Removed console statement
      return rule;
    }
  }

  // Removed console statement
  return null;
}

// Function to get and apply the correct speed for current tab
function getCurrentTabAndApplySpeed(): void {
  safeRuntimeMessage({ type: "GET_CURRENT_TAB" }, (response) => {
    if (!response) {
      // Removed console statement
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
            currentTabId
          );
          initializePlaybackRate(speed, source);
          observeMediaChanges(speed, source);
        }
      );
    }
  });
}

// Function to handle URL changes in SPAs
function handleUrlChange(): void {
  const newUrl = window.location.href;
  if (newUrl !== currentUrl) {
    // Removed console statement
    currentUrl = newUrl;

    // Re-determine and apply the correct speed for the new URL
    getCurrentTabAndApplySpeed();
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
