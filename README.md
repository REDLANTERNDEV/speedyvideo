# SpeedyVideo - Control Video Playback Speed

A powerful Chrome extension that gives you complete control over video playback speed across the entire web. Speed up, slow down, or maintain normal playback on any website with HTML5 video content.

## ✨ Features

- **Universal Compatibility**: Works on virtually any website with HTML5 video players
- **Smooth Speed Control**: Adjust playback speed from 0.25x to 2.0x+ with precision controls
- **Domain-Specific Rules**: Set different speeds for different websites automatically
- **Tab Pinning**: Pin specific speeds to individual tabs
- **URL Exclusions**: Exclude certain websites from speed control
- **Blacklist Support**: Block speed changes on protected sites (YouTube Gaming, GeForceNow, etc.)
- **Dark/Light Theme**: Choose your preferred UI theme
- **Shadow DOM Support**: Works with modern web components and shadow DOM video players
- **Infinite Scroll Support**: Compatible with Reddit, Twitter, TikTok, Instagram, and other infinite scroll sites
- **Zero Telemetry**: No tracking, no analytics, no data collection

## 🚀 Installation

### From Chrome Web Store

1. Visit the [Chrome Web Store](https://chrome.google.com/webstore)
2. Search for "SpeedyVideo"
3. Click "Add to Chrome"
4. Confirm the permissions and enjoy!

### Manual Installation (Development)

1. Clone this repository
2. Run `npm install` and `npm run build`
3. Open `chrome://extensions/` in your browser
4. Enable "Developer mode" (top right)
5. Click "Load unpacked" and select the `dist` folder

## 💻 Usage

1. **Open any video** on your favorite website
2. **Click the SpeedyVideo icon** in your browser toolbar
3. **Adjust the speed** using the slider or preset buttons
4. **Save domain rules** to automatically apply speeds to specific websites
5. **Pin speeds** to the current tab for temporary speed changes

### Controls

- **Speed Slider**: Precise control over playback speed
- **Preset Buttons**: Quick access to common speeds (0.5x, 1.0x, 1.5x, 2.0x)
- **Domain Settings**: Create custom rules for specific websites
- **Pin Button**: Lock the current speed to this tab
- **Settings**: Access advanced configuration options
- **Theme Toggle**: Switch between dark and light modes

## ⚙️ Settings

### Domain Rules

Create custom speed rules for specific websites. When you visit a domain with a rule, the speed is automatically applied.

**Example domains:**

- YouTube: 1.5x
- Vimeo: 1.25x
- Courses: 1.75x

### URL Exclusions

Prevent speed changes on specific URLs using patterns:

- `starts_` - Match URLs starting with a pattern
- `contains_` - Match URLs containing a pattern
- `exact_` - Match exact URLs

### Blacklist Domains

Some websites don't support playback speed changes. SpeedyVideo automatically excludes:

- Google Docs, Google Play Games
- Xbox, PlayStation, Luna (cloud gaming)
- Stadia, GeForce NOW
- And many more...

## 🔒 Privacy & Security

- **Zero Data Collection**: SpeedyVideo collects NO personal data
- **Local Storage Only**: All settings are stored on your device
- **No Tracking**: No analytics, no telemetry, no external requests
- **Open Source**: Code is transparent and auditable

For detailed information, see [PRIVACY.md](PRIVACY.md)

## ⚖️ Terms of Service

By using SpeedyVideo, you agree to the [Terms of Service](TERMS.md).

**Important:**

- SpeedyVideo modifies playback speed only - it does not download or modify video content
- Respect website terms of service when using this extension
- Some websites may prohibit speed modifications in their terms

## 🛠️ Development

### Requirements

- Node.js 18+
- npm or yarn

### Setup

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Build for production
npm run build

# Type checking
npm run lint
```

### Project Structure

```
speedyvideo/
├── src/
│   ├── content.ts       # Content script (injected into pages)
│   ├── background.ts    # Background service worker
│   ├── popup.tsx        # Popup UI
│   ├── App.tsx          # Main component
│   ├── components/      # UI components
│   ├── context/         # React context for state
│   └── styles/          # CSS styles
├── public/
│   ├── manifest.json    # Extension manifest
│   └── icons/           # Extension icons
└── vite.config.ts       # Vite configuration
```

## 🎯 Browser Compatibility

- ✅ Chrome 88+
- ✅ Chromium-based browsers (Edge, Brave, Opera, Vivaldi)
- ⚠️ Firefox support coming soon

## 🐛 Reporting Issues

Found a bug? Please open an [issue on GitHub](https://github.com/REDLANTERNDEV/speedyvideo/issues) with:

## 💡 Feature Requests

Have an idea? Share your suggestions by opening a [GitHub issue](https://github.com/REDLANTERNDEV/speedyvideo/issues) labeled as "enhancement".

## 🤝 Contributing

We welcome contributions! Please:

1.  Fork the repository
2.  Create a feature branch (`git checkout -b feature/AmazingFeature`)
3.  Make your changes
4.  Commit your changes (`git commit -m 'Add some AmazingFeature'`)
5.  Push to the branch (`git push origin feature/AmazingFeature`)
6.  Open a Pull Request

        [Report bugs or request features](https://github.com/REDLANTERNDEV/speedyvideo/issues)
        [GitHub Issues](https://github.com/REDLANTERNDEV/speedyvideo/issues)

    This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

**Note on Assets**: Logos, icons, and visual assets are not covered under the GNU General Public License v3.0 and may not be reused without permission.

## 🙏 Credits

SpeedyVideo was created by passionate developers who love faster video playback!

## 📞 Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/REDLANTERNDEV/speedyvideo/issues)
- **Privacy Concerns**: See [PRIVACY.md](PRIVACY.md)
- **Legal Questions**: See [TERMS.md](TERMS.md)

---

**Made with ❤️ for faster, better video watching.**

**⭐ If you find SpeedyVideo useful, please consider giving it a star on GitHub!**
