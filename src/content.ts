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
    console.warn(
      "[SpeedyVideo] Global error caught - Extension context invalidated"
    );
    extensionContextLost = true;
    // Switch to standalone mode
    switchToStandaloneMode();
    event.preventDefault(); // Prevent the error from being logged
  }
});

// Function to switch to standalone mode when extension context is lost
function switchToStandaloneMode() {
  console.log(
    "[SpeedyVideo] Switching to standalone mode - no extension communication"
  );

  // Get last known speed from localStorage as fallback
  const lastSpeed = localStorage.getItem("speedyVideoLastSpeed") || "1";
  const speed = parseFloat(lastSpeed);

  console.log(`[SpeedyVideo] Using standalone speed: ${speed}`);
  initializePlaybackRate(speed);
  observeMediaChanges(speed);
}

// Global variable to track current URL and tab info
let currentUrl = window.location.href;
let currentTabId: number | null = null;
let currentAppliedSpeed: number = 1.0; // Track the currently applied speed

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

// Synchronous version for immediate checking with default patterns only
function isUrlExcludedSync(url: string = window.location.href): boolean {
  const urlLower = url.toLowerCase();

  for (const pattern of DEFAULT_EXCLUSION_PATTERNS) {
    if (pattern.startsWith("starts_")) {
      const urlPattern = pattern.substring(7).toLowerCase();
      if (urlLower.startsWith(urlPattern)) {
        console.log(
          `[SpeedyVideo] URL excluded by default pattern: ${pattern}`
        );
        return true;
      }
    } else if (pattern.startsWith("contains_")) {
      const searchTerm = pattern.substring(9).toLowerCase();
      if (urlLower.includes(searchTerm)) {
        console.log(
          `[SpeedyVideo] URL excluded by default pattern: ${pattern}`
        );
        return true;
      }
    }
  }

  return false;
}

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
      console.log(
        `[SpeedyVideo] Domain blacklisted (exact): ${blacklistedDomain}`
      );
      return true;
    }

    // Check if current hostname is a subdomain of blacklisted domain
    if (currentHostname.endsWith("." + blacklistedDomain)) {
      console.log(
        `[SpeedyVideo] Domain blacklisted (subdomain): ${blacklistedDomain}`
      );
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
      console.log(
        `[SpeedyVideo] Domain blacklisted (www variant): ${blacklistedDomain}`
      );
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
    console.log(
      "[SpeedyVideo] User has custom domain rule - skipping exclusion"
    );
    return false;
  }

  const patterns = exclusionPatterns || DEFAULT_EXCLUSION_PATTERNS;
  const currentUrlLower = window.location.href.toLowerCase();

  for (const pattern of patterns) {
    if (pattern.startsWith("starts_")) {
      const urlPattern = pattern.substring(7).toLowerCase();
      if (currentUrlLower.startsWith(urlPattern)) {
        console.log(`[SpeedyVideo] URL excluded by pattern: ${pattern}`);
        return true;
      }
    } else if (pattern.startsWith("contains_")) {
      const searchTerm = pattern.substring(9).toLowerCase();
      if (currentUrlLower.includes(searchTerm)) {
        console.log(`[SpeedyVideo] URL excluded by pattern: ${pattern}`);
        return true;
      }
    } else if (pattern.startsWith("exact_")) {
      const exactUrl = pattern.substring(6).toLowerCase();
      if (currentUrlLower === exactUrl) {
        console.log(`[SpeedyVideo] URL excluded by exact match: ${pattern}`);
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
    console.warn("[SpeedyVideo] Could not query selector on root", root, e);
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

function updateMediaPlaybackRate(speed: number): void {
  // Use the new recursive function to find all media elements
  const mediaElements = findAllMediaElements(document);

  let updatedCount = 0;
  mediaElements.forEach((media) => {
    if (media.playbackRate !== speed) {
      // Only update if different
      media.playbackRate = speed;
      updatedCount++;
    }
  });

  // Update video count tracking
  if (mediaElements.length !== lastVideoCount) {
    console.log(
      `[SpeedyVideo] Video count changed from ${lastVideoCount} to ${mediaElements.length}`
    );
    lastVideoCount = mediaElements.length;
  }

  if (updatedCount > 0) {
    currentAppliedSpeed = speed; // Update the tracked speed
    // Save to localStorage as fallback
    localStorage.setItem("speedyVideoLastSpeed", speed.toString());
    console.log(
      `[SpeedyVideo] Set playback rate to ${speed} on ${updatedCount}/${mediaElements.length} media elements (recursive update)`
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
      updateMediaPlaybackRate(speed);
    }, 50); // Reduced from 100ms to 50ms for faster response
  });
  mediaObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src", "autoplay", "preload"],
  });

  // Intersection observer for videos entering viewport (Reddit optimization)
  intersectionObserver = new IntersectionObserver(
    (entries) => {
      let hasNewVideos = false;
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.target instanceof HTMLVideoElement) {
          const video = entry.target;
          if (video.playbackRate !== speed) {
            video.playbackRate = speed;
            hasNewVideos = true;
          }
        }
      });

      if (hasNewVideos) {
        console.log(
          `[SpeedyVideo] Applied speed ${speed} to videos entering viewport`
        );
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
        console.log(
          `[SpeedyVideo] Periodic check: video count changed from ${lastVideoCount} to ${currentVideoCount}`
        );
        updateMediaPlaybackRate(speed);

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
        updateMediaPlaybackRate(speed);
      }, 200); // Check for new videos 200ms after scroll stops
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    // Reddit-specific event listeners for better video detection
    if (window.location.hostname.toLowerCase().includes("reddit.com")) {
      // Listen for Reddit's custom events if available
      document.addEventListener("reddit:media-loaded", () => {
        console.log("[SpeedyVideo] Reddit media loaded event detected");
        updateMediaPlaybackRate(speed);
      });

      // Listen for changes to Reddit's post containers
      const redditPostObserver = new MutationObserver(() => {
        clearTimeout(debounceTimerId);
        debounceTimerId = window.setTimeout(() => {
          updateMediaPlaybackRate(speed);
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
    if (result.extensionState === false) {
      // Extension is disabled, do not run logic
      console.log(
        "[SpeedyVideo] Extension is globally disabled. No logic will run."
      );
      return;
    }

    // Check if current domain is blacklisted (takes absolute priority)
    if (isCurrentDomainBlacklisted(result.blacklistDomains)) {
      console.log(
        "[SpeedyVideo] Current domain is blacklisted - extension will not run"
      );
      return;
    }

    // Get current tab ID to check for domain rules and pinned speeds
    safeRuntimeMessage({ type: "GET_CURRENT_TAB" }, (response) => {
      // Check for runtime errors or null response (fallback scenario)
      if (!response) {
        // Check exclusions for fallback case (no domain rules available)
        if (
          shouldExcludeUrl(result.websitesAddedToUrlConditionsExclusion, false)
        ) {
          console.log(
            "[SpeedyVideo] URL excluded in fallback mode - extension will not run"
          );
          return;
        }

        // Fallback to basic functionality without tab-specific features
        const speed = result.selectedSpeed
          ? parseFloat(result.selectedSpeed)
          : 1;
        console.log(`[SpeedyVideo] Using fallback speed: ${speed}`);
        initializePlaybackRate(speed);
        observeMediaChanges(speed);
        return;
      }

      if (response?.tabId) {
        currentTabId = response.tabId;

        chrome.storage.local.get(
          [`pinnedSpeed_${currentTabId}`],
          (tabResult) => {
            let speed: number;
            let speedSource: string;

            // Priority 1: Pinned Speed
            if (tabResult[`pinnedSpeed_${currentTabId}`] !== undefined) {
              speed = parseFloat(tabResult[`pinnedSpeed_${currentTabId}`]);
              speedSource = "pinned";
            } else {
              // Priority 2: Domain Rule
              const hostname = window.location.hostname.toLowerCase();
              const domainRule = findDomainRuleForHostname(
                result.domainSpeeds || [],
                hostname
              );

              if (domainRule) {
                speed = domainRule.speed;
                speedSource = "domain rule";
                console.log(
                  `[SpeedyVideo] Found domain rule for ${hostname}: ${speed}x - overrides exclusions`
                );
              } else {
                // Priority 3: Check exclusions (only if no user domain rule)
                if (
                  shouldExcludeUrl(
                    result.websitesAddedToUrlConditionsExclusion,
                    false
                  )
                ) {
                  console.log(
                    "[SpeedyVideo] URL excluded and no user domain rule - extension will not run"
                  );
                  return;
                }

                // Priority 4: Global Speed
                speed = result.selectedSpeed
                  ? parseFloat(result.selectedSpeed)
                  : 1;
                speedSource = "global";
              }
            }

            console.log(
              `[SpeedyVideo] Initializing with ${speedSource} speed: ${speed}`
            );
            initializePlaybackRate(speed);
            observeMediaChanges(speed);
          }
        );
      } else {
        // Fallback if tab ID not available
        const speed = result.selectedSpeed
          ? parseFloat(result.selectedSpeed)
          : 1;
        console.log(`[SpeedyVideo] Initializing with fallback speed: ${speed}`);
        initializePlaybackRate(speed);
        observeMediaChanges(speed);
      }
    });

    // Setup URL change listeners for SPAs
    setupUrlChangeListeners();
  }
);

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
  } else if (message.type === "GET_CURRENT_SPEED") {
    // Return the current speed of video elements
    const mediaElements =
      document.querySelectorAll<HTMLMediaElement>("video, audio");
    const speeds = Array.from(mediaElements).map((media) => media.playbackRate);
    const currentSpeed = speeds.length > 0 ? speeds[0] : currentAppliedSpeed;

    console.log(
      `[SpeedyVideo] Current speed requested, returning: ${currentSpeed}`
    );
    sendResponse({
      currentSpeed,
      appliedSpeed: currentAppliedSpeed,
      mediaCount: speeds.length,
    });
    return true;
  } else if (message.type === "DISABLE_SPEEDYVIDEO") {
    // Set all media elements to default speed and stop observing
    const defaultSpeed = 1.0;
    initializePlaybackRate(defaultSpeed);

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

// Helper function to safely send messages with retry
function safeRuntimeMessage(
  message: any,
  callback?: (response: any) => void,
  retryCount = 0
) {
  // If extension context is lost, immediately use fallback
  if (extensionContextLost) {
    console.warn(
      "[SpeedyVideo] Extension context lost - using fallback immediately"
    );
    if (callback) callback(null);
    return;
  }

  try {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        console.warn(
          `[SpeedyVideo] Runtime error (attempt ${retryCount + 1}):`,
          chrome.runtime.lastError.message
        );

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
    console.error("[SpeedyVideo] Error sending runtime message:", error);
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
  console.log("[Content] findDomainRuleForHostname called with:", {
    domainSpeeds,
    hostname,
    domainSpeedsCount: domainSpeeds?.length || 0,
  });

  if (!Array.isArray(domainSpeeds) || domainSpeeds.length === 0) {
    console.log("[Content] No domain speeds available");
    return null;
  }

  const hostnameNormalized = hostname.toLowerCase();
  console.log("[Content] Normalized hostname:", hostnameNormalized);

  // Try exact match first
  for (const rule of domainSpeeds) {
    const ruleHostname = rule.domain.toLowerCase();
    console.log("[Content] Checking exact match:", {
      ruleHostname,
      hostnameNormalized,
    });
    if (hostnameNormalized === ruleHostname) {
      console.log("[Content] Found exact match:", rule);
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

    console.log("[Content] Checking www variations:", {
      ruleHostname,
      hostnameNoWww,
      ruleNoWww,
    });

    if (hostnameNoWww === ruleNoWww) {
      console.log("[Content] Found www match:", rule);
      return rule;
    }

    // Check subdomain
    if (hostnameNormalized.endsWith("." + ruleNoWww)) {
      console.log("[Content] Found subdomain match:", rule);
      return rule;
    }
  }

  console.log("[Content] No domain rule found for:", hostname);
  return null;
}

// Function to get and apply the correct speed for current tab
function getCurrentTabAndApplySpeed(): void {
  // Get current tab ID from chrome API
  safeRuntimeMessage({ type: "GET_CURRENT_TAB" }, (response) => {
    // Check for runtime errors or null response
    if (!response) {
      console.warn(
        "[SpeedyVideo] Runtime error in getCurrentTabAndApplySpeed - using fallback"
      );
      // Apply global speed as fallback
      chrome.storage.local.get(["selectedSpeed"], (result) => {
        const speed = result.selectedSpeed
          ? parseFloat(result.selectedSpeed)
          : 1.0;
        console.log(`[SpeedyVideo] Using fallback global speed: ${speed}`);
        initializePlaybackRate(speed);
        observeMediaChanges(speed);
      });
      return;
    }

    if (response?.tabId) {
      currentTabId = response.tabId;

      // Check for all relevant storage keys including domain rules and exclusions
      chrome.storage.local.get(
        [
          "extensionState",
          `pinnedSpeed_${currentTabId}`,
          "selectedSpeed",
          "domainSpeeds",
          "websitesAddedToUrlConditionsExclusion",
        ],
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

          // Priority 1: Pinned Speed (highest)
          if (result[`pinnedSpeed_${currentTabId}`] !== undefined) {
            speed = parseFloat(result[`pinnedSpeed_${currentTabId}`]);
            speedSource = "pinned";
          } else {
            // Priority 2: Domain Rule
            const hostname = window.location.hostname.toLowerCase();
            const domainRule = findDomainRuleForHostname(
              result.domainSpeeds || [],
              hostname
            );

            if (domainRule) {
              speed = domainRule.speed;
              speedSource = "domain rule";
              console.log(
                `[SpeedyVideo] Found domain rule for ${hostname}: ${speed}x - overrides exclusions`
              );
            } else {
              // Priority 3: Check exclusions (only if no user domain rule)
              if (
                shouldExcludeUrl(
                  result.websitesAddedToUrlConditionsExclusion,
                  false
                )
              ) {
                console.log(
                  "[SpeedyVideo] URL excluded and no user domain rule - extension will not run"
                );
                return;
              }

              // Priority 4: Global Speed (fallback)
              speed = result.selectedSpeed
                ? parseFloat(result.selectedSpeed)
                : 1.0;
              speedSource = "global";
            }
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

    // Check if new URL should be excluded
    if (isUrlExcludedSync(newUrl)) {
      console.log(
        `[SpeedyVideo] New URL is excluded, disabling extension functionality`
      );

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

      // Reset all videos to normal speed
      const mediaElements =
        document.querySelectorAll<HTMLMediaElement>("video, audio");
      mediaElements.forEach((media) => {
        media.playbackRate = 1.0;
      });

      return;
    }

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
