# 🐍 Snakey Chrome Extension - DOM Eating Snake

A modern, interactive Chrome Extension that turns the web into your snake's sandbox. With a single click in your browser toolbar, a snake is released directly onto any active webpage, allowing you to slither around and devour all DOM elements (text characters, headings, images, cards, inputs, and interactive widgets) in real time!

---

## ✨ Features

- **One-Click Activation**: No initial arcade cabinet screen or normal-phase score requirements. Clicking the extension icon in the toolbar immediately releases the snake at the center of your current screen viewport.
- **Proximity-Based Lazy DOM Splitting (Performance Optimization)**:
  - **Zero Startup Lag**: Heavy webpages (like Wikipedia or complex dashboards) are scanned in milliseconds without UI freezing, because text nodes are *not* split at startup.
  - **Just-In-Time Splitting**: Text paragraphs, lists, and headers are represented as single blocks. They are dynamically split *only* when the snake crawls within a **100px buffer** of them.
  - **Conditional Text Splitting**: The splitting logic adapts based on styling:
    - **Letter-by-Letter**: Large text (computed font-size `>= 20px`) and heading elements (`<h1>`-`<h6>`) are split character-by-character to preserve the classic letter-eating aesthetic on titles.
    - **Word-by-Word**: Standard body paragraphs and list items are split word-by-word, reducing DOM nodes and physics elements by **5x-6x** to keep layout operations completely lag-free.
  - **Memory Efficiency**: Keeps the DOM lightweight and physics loops operating at high frame rates, even on massive webpages.
- **Universal DOM Devouring**:
  - Eats leaf characters and text.
  - Collapses visual cards using style-based layout bounding clone boxes.
  - Triggers custom interactive behaviors on special elements: drains progress bars, vibrates input fields, clicks checkboxes, expansions on dropdown selectors, and speeds up media playbacks.
- **Website Collapse Finale**: If the snake crawls off the page limits, the entire website rotates, blurs, and slides into a black void before the page reloads.

---

## 🛠️ Tech Stack

- **React 19**
- **Vite 8**
- **Phaser 3 / Phaser 4 (Phaser.AUTO)**
- **Tailwind CSS 4**
- **TypeScript**
- **Chrome Extension Manifest V3**

---

## 🚀 Installation & Loading the Extension

To install and load the unpacked extension in Chrome:

### 1. Build the Extension Local Directory
Ensure you have [Node.js](https://nodejs.org/) installed:

1. Clone and enter the extension branch directory:
   ```bash
   git clone -b snakey-extension https://github.com/andreyyste/snakey.git snakey-extension
   cd snakey-extension
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Compile the production bundles:
   ```bash
   npm run build
   ```
   *This outputs the extension package files directly to the `dist/` directory, including `manifest.json`, `background.js`, and compiled assets.*

### 2. Load the Unpacked Extension in Chrome
1. Open Google Chrome (or any Chromium-based browser).
2. Go to the extension settings page: `chrome://extensions/`.
3. Enable **Developer mode** using the toggle switch in the top-right corner.
4. Click the **Load unpacked** button in the top-left corner.
5. Select the **`dist`** folder inside your `snakey-extension` project directory.

### 3. Let the Snake Loose!
1. Pin the **Snakey** extension icon to your toolbar.
2. Open any webpage (e.g., [Wikipedia: Snake](https://en.wikipedia.org/wiki/Snake)).
3. Click the extension icon.
4. Control the snake using **Arrow Keys** or **WASD**.
5. Eat the web! Press **SPACE** to restart if you die.

---

## 🧠 The DOM Destruction Engine (Architecture)

The heart of *Snakey* is its custom DOM parser and rendering pipeline, built to bridge the gap between Phaser's WebGL/Canvas game loops and the browser's Document Object Model (DOM).

```
                 [ Phaser Game Loop ]
                          │
            Detects head coordinate overlap
                          │
                          ▼
                    [ DomManager ]
             Orchestrates & tracks state
             │            │            │
      Scans dynamic       │      Triggers anims
      DOM updates         │      upon chomps
             │            │            │
             ▼            ▼            ▼
       [ DomScanner ]  [ Physics ]  [ DomAnimator ]
      Recurses shadow  Synchronizes  Applies tag-specific
       DOM / elements   rect bounds  CSS & pseudo transitions
```

### 🔍 1. `DomScanner` (The Parser)
The `DomScanner` acts as the parser. It crawls the webpage DOM and generates target coordinate bodies for Phaser.
- **Recursive Tree Walking**: Walks the DOM tree node-by-node, analyzing child elements and text layouts.
- **Shadow DOM Traversal**: Recursively traverses shadow roots (`shadowRoot`), unlocking the ability to scan inside custom Web Components and embedded widgets.
- **Computed Visibility Filtering**: Checks computed style values (`window.getComputedStyle`) to ignore elements hidden via `display: none`, `visibility: hidden`, or `opacity: 0`.
- **Phaser Canvas Excluder**: Automatically identifies the Phaser game canvas and prevents the snake from eating the container rendering the game.
- **Multi-Element Mapping**: Targets a wide array of tags: `img`, `svg`, `video`, `input`, `textarea`, `button`, `a`, `select`, `progress`, `meter`, `canvas`, `hr`, `iframe`, and `audio`.
- **Universal Card Detection**: Dynamically identifies card-like block layouts on any webpage using style-based heuristics (backgrounds, borders, shadows, and dimensions) rather than static class name checks.
- **Lazy Text Scanning**: Identifies low-level unsplit `textContainer` elements (e.g. paragraphs `<p>`, list items `<li>`, headers `<h1>`) to avoid parsing and mutating the entire DOM at startup.

### ⚙️ 2. `DomManager` (The Orchestrator)
The `DomManager` acts as the main bridge keeping state, listening to browser viewport changes, and performing collision calculations.
- **Dynamic Mutation Observer**: Integrates a `MutationObserver` to watch for dynamically added elements (lazy-loaded elements, infinite scrolling) and triggers rescans safely.
- **Proximity Just-In-Time Splitting**: Runs proximity checks against `textContainer` elements using a **100px buffer** around the snake's head. When the snake crawls close to a paragraph, that paragraph's text nodes are split *just-in-time* (letter-by-letter for headings/large text, word-by-word for standard body text), ensuring absolutely zero lag.
- **Viewport Scroll-Aware Bounds**: Keeps snake movement bound within the current viewport (`window.scrollX` / `window.scrollY` limits), allowing the snake to feel like it scrolls dynamically with the page.
- **Collision Syncing**: Compares Phaser's head coordinates to `domBodies` coordinates (updated dynamically on resize/scroll) and flags them in memory.
- **Canvas Lifecycle Restoration**: When the game restarts, it completely restores the Phaser canvas back to its original layout, strips off full-screen fixed styling, resets the scale resolution, and cleans up observers.

### 🎨 3. `DomAnimator` (The Animator)
The `DomAnimator` triggers specific transitions on HTML elements when eaten by the snake:
- **`select` (Dropdown)**: Dynamically expands the dropdown option list (`select.size`) for 300ms, simulating a visual dropdown click, before chomping and shrinking.
- **`hr` (Horizontal Line)**: Scales horizontally down (`scaleX(0)`) to center before fading.
- **`progress` / `meter`**: Animates the value bar draining down to 0 over 200ms before scaling to 0.
- **`input[type=checkbox]` / `input[type=radio]`**: Triggers a rapid click toggle (6 times at 50ms interval) to simulate click madness before disappearing.
- **`input` / `textarea`**: Shakes horizontally (vibration effect) for 400ms before spinning and shrinking.
- **`audio` / `video`**: Instantly speeds up playback rate to 3.0x and fades out audio volume to 0 (if playing) before pausing and shrinking.
- **Universal Card Chomping**: Lazily clones any card's computed styles (shadow, border, background, border-radius) onto an absolutely positioned dynamic background wrapper `div` (`.dynamic-card-bg`), hides the original card background, and scales the wrapper to 0. This allows card backgrounds to crumble on **any website** while keeping inner text intact and edible.
- **Descendant Cleanup**: Automatically marks all children of eaten elements as eaten to avoid leaving "ghost" collider blocks.

---

## 📜 License
This project is open-source and available under the MIT License.
