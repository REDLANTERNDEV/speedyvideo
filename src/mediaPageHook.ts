type SpeedyVideoMediaMessage = {
  type: "SPEEDYVIDEO_MEDIA_COMMAND";
  source: "speedyvideo";
  command: "set-speed" | "disable";
  speed?: number;
};

const MESSAGE_TYPE = "SPEEDYVIDEO_MEDIA_COMMAND";
const MESSAGE_SOURCE = "speedyvideo";
const MEDIA_EVENTS = [
  "loadedmetadata",
  "canplay",
  "play",
  "playing",
  "ratechange",
] as const;
const MEDIA_CLEANUP_EVENTS = ["abort", "emptied", "ended"] as const;
const MAX_TRACKED_MEDIA = 32;

let currentSpeed = 1.0;
let isEnabled = false;
let isApplying = false;
const watchedMedia = new WeakSet<HTMLMediaElement>();
const trackedMedia = new Set<HTMLMediaElement>();

function isMediaElement(value: unknown): value is HTMLMediaElement {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as {
    nodeName?: unknown;
    addEventListener?: unknown;
  };
  const nodeName =
    typeof candidate.nodeName === "string"
      ? candidate.nodeName.toUpperCase()
      : "";

  return (
    (nodeName === "AUDIO" || nodeName === "VIDEO") &&
    typeof candidate.addEventListener === "function" &&
    "defaultPlaybackRate" in value &&
    "playbackRate" in value
  );
}

function normalizeSpeed(speed: unknown): number {
  if (typeof speed !== "number" || !Number.isFinite(speed)) {
    return 1.0;
  }

  return Math.min(16, Math.max(0.1, speed));
}

function setPreservesPitch(media: HTMLMediaElement): void {
  const pitchMedia = media as HTMLMediaElement & {
    preservesPitch?: boolean;
    mozPreservesPitch?: boolean;
    webkitPreservesPitch?: boolean;
  };

  if ("preservesPitch" in pitchMedia) {
    pitchMedia.preservesPitch = true;
  }
  if ("mozPreservesPitch" in pitchMedia) {
    pitchMedia.mozPreservesPitch = true;
  }
  if ("webkitPreservesPitch" in pitchMedia) {
    pitchMedia.webkitPreservesPitch = true;
  }
}

function applyRate(media: HTMLMediaElement, speed = currentSpeed): void {
  if (!isEnabled) return;

  isApplying = true;
  try {
    setPreservesPitch(media);

    if (media.defaultPlaybackRate !== speed) {
      media.defaultPlaybackRate = speed;
    }
    if (media.playbackRate !== speed) {
      media.playbackRate = speed;
    }
  } catch {
    // Some players temporarily reject playbackRate writes during setup.
  } finally {
    isApplying = false;
  }
}

function resetRate(media: HTMLMediaElement): void {
  isApplying = true;
  try {
    if (media.defaultPlaybackRate !== 1.0) {
      media.defaultPlaybackRate = 1.0;
    }
    if (media.playbackRate !== 1.0) {
      media.playbackRate = 1.0;
    }
  } catch {
    // Ignore media elements that are not writable at this moment.
  } finally {
    isApplying = false;
  }
}

function rememberMedia(media: HTMLMediaElement): void {
  if (trackedMedia.has(media)) return;

  if (trackedMedia.size >= MAX_TRACKED_MEDIA) {
    const oldestMedia = trackedMedia.values().next().value;

    if (oldestMedia) {
      trackedMedia.delete(oldestMedia);
    }
  }

  trackedMedia.add(media);
}

function forgetMedia(media: HTMLMediaElement): void {
  trackedMedia.delete(media);
}

function watchMedia(media: HTMLMediaElement): void {
  rememberMedia(media);

  if (watchedMedia.has(media)) {
    applyRate(media);
    return;
  }

  watchedMedia.add(media);

  MEDIA_EVENTS.forEach((eventName) => {
    media.addEventListener(
      eventName,
      () => {
        rememberMedia(media);
        if (isApplying || !isEnabled) return;
        applyRate(media);
      },
      true,
    );
  });

  MEDIA_CLEANUP_EVENTS.forEach((eventName) => {
    media.addEventListener(
      eventName,
      () => {
        forgetMedia(media);
      },
      true,
    );
  });

  applyRate(media);
}

function findMedia(root: Document | ShadowRoot | Element): HTMLMediaElement[] {
  const media: HTMLMediaElement[] = [];

  if (isMediaElement(root)) {
    media.push(root);
  }

  try {
    if ("querySelectorAll" in root) {
      media.push(...Array.from(root.querySelectorAll<HTMLMediaElement>("audio, video")));
    }
  } catch {
    // Ignore inaccessible roots.
  }

  try {
    const descendants =
      "querySelectorAll" in root ? Array.from(root.querySelectorAll<Element>("*")) : [];

    descendants.forEach((element) => {
      if (element.shadowRoot) {
        media.push(...findMedia(element.shadowRoot));
      }
    });
  } catch {
    // Ignore inaccessible roots.
  }

  return media;
}

function watchExistingMedia(): void {
  findMedia(document).forEach(watchMedia);
}

function applyRateToTrackedMedia(): void {
  trackedMedia.forEach((media) => {
    applyRate(media);
  });
}

function resetKnownMedia(): void {
  findMedia(document).forEach(resetRate);
  trackedMedia.forEach(resetRate);
}

function patchMediaPrototype(): void {
  const playbackDescriptor = Object.getOwnPropertyDescriptor(
    HTMLMediaElement.prototype,
    "playbackRate",
  );

  if (playbackDescriptor?.get && playbackDescriptor.set) {
    Object.defineProperty(HTMLMediaElement.prototype, "playbackRate", {
      configurable: true,
      enumerable: playbackDescriptor.enumerable,
      get(this: HTMLMediaElement): number {
        return playbackDescriptor.get!.call(this) as number;
      },
      set(this: HTMLMediaElement, value: number) {
        const nextSpeed = isEnabled ? currentSpeed : value;
        playbackDescriptor.set!.call(this, nextSpeed);
      },
    });
  }

  const defaultPlaybackDescriptor = Object.getOwnPropertyDescriptor(
    HTMLMediaElement.prototype,
    "defaultPlaybackRate",
  );

  if (defaultPlaybackDescriptor?.get && defaultPlaybackDescriptor.set) {
    Object.defineProperty(HTMLMediaElement.prototype, "defaultPlaybackRate", {
      configurable: true,
      enumerable: defaultPlaybackDescriptor.enumerable,
      get(this: HTMLMediaElement): number {
        return defaultPlaybackDescriptor.get!.call(this) as number;
      },
      set(this: HTMLMediaElement, value: number) {
        const nextSpeed = isEnabled ? currentSpeed : value;
        defaultPlaybackDescriptor.set!.call(this, nextSpeed);
      },
    });
  }

  const playDescriptor = Object.getOwnPropertyDescriptor(
    HTMLMediaElement.prototype,
    "play",
  );
  const originalPlay = playDescriptor?.value as
    | ((this: HTMLMediaElement) => Promise<void>)
    | undefined;

  if (originalPlay) {
    HTMLMediaElement.prototype.play = function play(): Promise<void> {
      if (isMediaElement(this)) {
        watchMedia(this);
        applyRate(this);
      }

      const result = originalPlay.call(this);

      if (isMediaElement(this)) {
        void result.then(
          () => applyRate(this),
          () => applyRate(this),
        );
      }

      return result;
    };
  }

  const loadDescriptor = Object.getOwnPropertyDescriptor(
    HTMLMediaElement.prototype,
    "load",
  );
  const originalLoad = loadDescriptor?.value as
    | ((this: HTMLMediaElement) => void)
    | undefined;

  if (originalLoad) {
    HTMLMediaElement.prototype.load = function load(): void {
      if (isMediaElement(this)) {
        watchMedia(this);
        applyRate(this);
      }

      return originalLoad.call(this);
    };
  }
}

function handleCommand(message: SpeedyVideoMediaMessage): void {
  if (message.command === "disable") {
    isEnabled = false;
    currentSpeed = 1.0;
    resetKnownMedia();
    return;
  }

  if (message.command === "set-speed") {
    isEnabled = true;
    currentSpeed = normalizeSpeed(message.speed);
    watchExistingMedia();
    applyRateToTrackedMedia();
  }
}

function isSpeedyVideoMessage(value: unknown): value is SpeedyVideoMediaMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as SpeedyVideoMediaMessage).type === MESSAGE_TYPE &&
    (value as SpeedyVideoMediaMessage).source === MESSAGE_SOURCE &&
    ((value as SpeedyVideoMediaMessage).command === "set-speed" ||
      (value as SpeedyVideoMediaMessage).command === "disable")
  );
}

window.addEventListener("message", (event) => {
  if (event.source !== window || !isSpeedyVideoMessage(event.data)) {
    return;
  }

  handleCommand(event.data);
});

patchMediaPrototype();
