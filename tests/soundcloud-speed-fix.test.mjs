import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function transpileSource(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.None,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
}

function createChromeStub({ storageData = {}, tabs = [] } = {}) {
  const sentMessages = [];
  const removedKeys = [];
  const storageGetRequests = [];

  const makeEvent = () => ({
    listeners: [],
    addListener(listener) {
      this.listeners.push(listener);
    },
  });

  const chrome = {
    runtime: {
      lastError: null,
      onInstalled: makeEvent(),
      onMessage: makeEvent(),
      onStartup: makeEvent(),
    },
    storage: {
      local: {
        get(keys, callback) {
          storageGetRequests.push(keys);
          const result =
            keys === null
              ? { ...storageData }
              : Array.isArray(keys)
                ? Object.fromEntries(
                    keys
                      .filter((key) => key in storageData)
                      .map((key) => [key, storageData[key]]),
                  )
                : typeof keys === "string"
                  ? { [keys]: storageData[keys] }
                  : { ...storageData };

          if (callback) {
            callback(result);
            return undefined;
          }

          return Promise.resolve(result);
        },
        remove(keys, callback) {
          const list = Array.isArray(keys) ? keys : [keys];
          removedKeys.push(...list);
          list.forEach((key) => {
            delete storageData[key];
          });

          if (callback) {
            callback();
            return undefined;
          }

          return Promise.resolve();
        },
        set(value, callback) {
          Object.assign(storageData, value);

          if (callback) {
            callback();
            return undefined;
          }

          return Promise.resolve();
        },
      },
      onChanged: makeEvent(),
    },
    tabs: {
      onRemoved: makeEvent(),
      onUpdated: makeEvent(),
      query(_queryInfo, callback) {
        if (callback) {
          callback(tabs);
          return undefined;
        }

        return Promise.resolve(tabs);
      },
      sendMessage(tabId, message, callback) {
        sentMessages.push({ tabId, message });
        if (callback) callback();
      },
    },
    __removedKeys: removedKeys,
    __sentMessages: sentMessages,
    __storageGetRequests: storageGetRequests,
  };

  return chrome;
}

function loadBackground({ storageData = {}, tabs = [] } = {}) {
  const chrome = createChromeStub({ storageData, tabs });
  const context = {
    chrome,
    console: {
      error() {},
      log() {},
      warn() {},
    },
    globalThis: {},
    navigator: {},
    self: {
      addEventListener() {},
    },
    setInterval() {
      return 1;
    },
    setTimeout(callback) {
      callback();
      return 1;
    },
    URL,
  };
  context.globalThis = context;

  const source = `${transpileSource("src/background.ts")}
globalThis.__speedyBackgroundTestApi = {
  cleanupOrphanedPinnedSpeeds,
  determineSpeedForTab,
};`;

  vm.runInNewContext(source, context, { filename: "src/background.ts" });
  return context;
}

class FakeMediaElement {
  constructor() {
    this.nodeName = "AUDIO";
    this.listeners = new Map();
    this._playbackRate = 1;
    this._defaultPlaybackRate = 1;
    this.preservesPitch = false;
  }

  addEventListener(eventName, listener) {
    const listeners = this.listeners.get(eventName) ?? [];
    listeners.push(listener);
    this.listeners.set(eventName, listeners);
  }

  dispatch(eventName) {
    for (const listener of this.listeners.get(eventName) ?? []) {
      listener();
    }
  }

  get playbackRate() {
    return this._playbackRate;
  }

  set playbackRate(value) {
    this._playbackRate = value;
  }

  get defaultPlaybackRate() {
    return this._defaultPlaybackRate;
  }

  set defaultPlaybackRate(value) {
    this._defaultPlaybackRate = value;
  }

  load() {}

  play() {
    return Promise.resolve();
  }
}

function loadMediaHook(media = new FakeMediaElement()) {
  const windowListeners = new Map();
  const context = {
    Array,
    Document: class Document {},
    Element: class Element {},
    HTMLMediaElement: FakeMediaElement,
    ShadowRoot: class ShadowRoot {},
    console: {
      error() {},
      log() {},
      warn() {},
    },
    document: {
      querySelectorAll(selector) {
        if (selector === "audio, video") {
          return [media];
        }

        return [];
      },
    },
    window: {
      addEventListener(eventName, listener) {
        const listeners = windowListeners.get(eventName) ?? [];
        listeners.push(listener);
        windowListeners.set(eventName, listeners);
      },
    },
  };
  context.globalThis = context;
  context.window.window = context.window;

  const source = `${transpileSource("src/mediaPageHook.ts")}
globalThis.__speedyMediaHookTestApi = {
  handleCommand,
  MEDIA_CLEANUP_EVENTS,
  MEDIA_EVENTS,
  trackedMedia,
};`;

  vm.runInNewContext(source, context, { filename: "src/mediaPageHook.ts" });
  return { context, media };
}

test("background uses global speed when domain rule is disabled for the tab", () => {
  const tabId = 12;
  const { __speedyBackgroundTestApi } = loadBackground();

  const result = __speedyBackgroundTestApi.determineSpeedForTab(
    tabId,
    "https://soundcloud.com/artist/track-two",
    {
      [`domainRuleDisabled_${tabId}`]: {
        disabledAt: Date.now(),
        hostname: "soundcloud.com",
      },
      domainSpeeds: [{ domain: "soundcloud.com", speed: 1.25 }],
      selectedSpeed: "1.75",
    },
  );

  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    speed: 1.75,
    speedSource: "global",
  });
});

test("background broadcasts selected speed to tabs with disabled domain rules", () => {
  const tabId = 21;
  const context = loadBackground({
    storageData: {
      [`domainRuleDisabled_${tabId}`]: {
        disabledAt: Date.now(),
        hostname: "soundcloud.com",
      },
      domainSpeeds: [{ domain: "soundcloud.com", speed: 1.25 }],
      selectedSpeed: "2.5",
    },
    tabs: [{ id: tabId, url: "https://soundcloud.com/artist/track-two" }],
  });

  const [onStorageChanged] = context.chrome.storage.onChanged.listeners;
  onStorageChanged({ selectedSpeed: { newValue: "2.5" } }, "local");

  assert(
    context.chrome.__storageGetRequests.some(
      (keys) =>
        Array.isArray(keys) && keys.includes(`domainRuleDisabled_${tabId}`),
    ),
    "selectedSpeed listener must request tab domain-rule disablement state",
  );
  assert.deepEqual(JSON.parse(JSON.stringify(context.chrome.__sentMessages)), [
    {
      tabId,
      message: {
        speed: 2.5,
        source: "global",
        type: "UPDATE_SPEED",
      },
    },
  ]);
});

test("background cleans domain-rule disablement state with other tab-scoped keys", async () => {
  const context = loadBackground({
    storageData: {
      activeDomainRule_100: { domain: "soundcloud.com", speed: 1.25 },
      domainRuleDisabled_100: {
        disabledAt: Date.now(),
        hostname: "soundcloud.com",
      },
      pinnedSpeed_100: "1.75",
    },
    tabs: [{ id: 200, url: "https://example.com" }],
  });

  await context.__speedyBackgroundTestApi.cleanupOrphanedPinnedSpeeds();

  assert.deepEqual(context.chrome.__removedKeys.sort(), [
    "activeDomainRule_100",
    "domainRuleDisabled_100",
    "pinnedSpeed_100",
  ]);
});

test("media hook keeps reused SoundCloud media tracked across next-track lifecycle", () => {
  const { context, media } = loadMediaHook();
  const { __speedyMediaHookTestApi } = context;

  assert(__speedyMediaHookTestApi.MEDIA_EVENTS.includes("loadstart"));
  assert(__speedyMediaHookTestApi.MEDIA_EVENTS.includes("durationchange"));
  assert(!__speedyMediaHookTestApi.MEDIA_CLEANUP_EVENTS.includes("ended"));
  assert(!__speedyMediaHookTestApi.MEDIA_CLEANUP_EVENTS.includes("emptied"));

  __speedyMediaHookTestApi.handleCommand({
    command: "set-speed",
    source: "speedyvideo",
    speed: 1.75,
    type: "SPEEDYVIDEO_MEDIA_COMMAND",
  });

  assert.equal(media.playbackRate, 1.75);
  assert(__speedyMediaHookTestApi.trackedMedia.has(media));

  media.dispatch("ended");
  media.dispatch("emptied");

  assert(
    __speedyMediaHookTestApi.trackedMedia.has(media),
    "SoundCloud reuses the audio element between tracks, so ended/emptied must not remove it",
  );
});
