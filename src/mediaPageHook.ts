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

let currentSpeed = 1.0;
let isEnabled = false;
let isApplying = false;
const watchedMedia = new WeakSet<HTMLMediaElement>();
const observedRoots = new WeakSet<Document | ShadowRoot>();
const activeObservers: MutationObserver[] = [];

function isMediaElement(value: unknown): value is HTMLMediaElement {
  return value instanceof HTMLMediaElement;
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

function watchMedia(media: HTMLMediaElement): void {
  if (watchedMedia.has(media)) {
    applyRate(media);
    return;
  }

  watchedMedia.add(media);

  MEDIA_EVENTS.forEach((eventName) => {
    media.addEventListener(
      eventName,
      () => {
        if (isApplying || !isEnabled) return;
        applyRate(media);
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

function resetExistingMedia(): void {
  findMedia(document).forEach(resetRate);
}

function patchCreateElement(): void {
  const createElementDescriptor = Object.getOwnPropertyDescriptor(
    Document.prototype,
    "createElement",
  );
  const originalCreateElement = createElementDescriptor?.value as
    | typeof Document.prototype.createElement
    | undefined;

  if (!originalCreateElement) return;

  Document.prototype.createElement = function createElement(
    this: Document,
    tagName: string,
    options?: ElementCreationOptions,
  ): HTMLElement {
    const element = originalCreateElement.call(this, tagName, options);

    if (isMediaElement(element)) {
      watchMedia(element);
    }

    return element;
  };

  const createElementNSDescriptor = Object.getOwnPropertyDescriptor(
    Document.prototype,
    "createElementNS",
  );
  const originalCreateElementNS = createElementNSDescriptor?.value as
    | typeof Document.prototype.createElementNS
    | undefined;

  if (!originalCreateElementNS) return;

  Document.prototype.createElementNS = function createElementNS(
    this: Document,
    namespaceURI: string | null,
    qualifiedName: string,
    options?: ElementCreationOptions,
  ): Element {
    const element = originalCreateElementNS.call(
      this,
      namespaceURI,
      qualifiedName,
      options,
    );

    if (isMediaElement(element)) {
      watchMedia(element);
    }

    return element;
  } as typeof Document.prototype.createElementNS;
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
      watchMedia(this);
      applyRate(this);
      return originalPlay.call(this);
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
      watchMedia(this);
      applyRate(this);
      return originalLoad.call(this);
    };
  }
}

function patchAttachShadow(): void {
  const attachShadowDescriptor = Object.getOwnPropertyDescriptor(
    Element.prototype,
    "attachShadow",
  );
  const originalAttachShadow = attachShadowDescriptor?.value as
    | typeof Element.prototype.attachShadow
    | undefined;

  if (!originalAttachShadow) return;

  Element.prototype.attachShadow = function attachShadow(
    init: ShadowRootInit,
  ): ShadowRoot {
    const shadowRoot = originalAttachShadow.call(this, init);
    observeRoot(shadowRoot);
    return shadowRoot;
  };
}

function observeRoot(root: Document | ShadowRoot): void {
  if (observedRoots.has(root)) return;

  observedRoots.add(root);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) {
          findMedia(node).forEach(watchMedia);
          if (node.shadowRoot) {
            observeRoot(node.shadowRoot);
          }
        }
      });
    });
  });
  activeObservers.push(observer);

  const attach = () => {
    const target = root instanceof Document ? root.documentElement : root;
    if (!target) return;

    observer.observe(target, {
      childList: true,
      subtree: true,
    });
    findMedia(root).forEach(watchMedia);
  };

  if (root instanceof Document && !root.documentElement) {
    document.addEventListener("DOMContentLoaded", attach, { once: true });
  } else {
    attach();
  }
}

function handleCommand(message: SpeedyVideoMediaMessage): void {
  if (message.command === "disable") {
    isEnabled = false;
    currentSpeed = 1.0;
    resetExistingMedia();
    return;
  }

  if (message.command === "set-speed") {
    isEnabled = true;
    currentSpeed = normalizeSpeed(message.speed);
    watchExistingMedia();
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

patchCreateElement();
patchMediaPrototype();
patchAttachShadow();
observeRoot(document);
