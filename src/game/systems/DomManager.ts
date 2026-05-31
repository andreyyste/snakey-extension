import Phaser from 'phaser';
import { DomScanner } from './DomScanner';
import { DomAnimator } from './DomAnimator';

export type DomBodyType = 'char' | 'media' | 'wall' | 'cardWall' | 'finalTarget';

export interface IDomBody {
  element: HTMLElement;
  body: Phaser.Geom.Rectangle;
  id: string;
  hasBeenEaten: boolean;
  type: DomBodyType;
}

/**
 * DomManager orchestrates the integration between the Phaser game scene and the webpage.
 * It manages the lifecycle of scanned DOM elements, coordinates window resize and scroll checks, 
 * performs physics-like rectangle collision detection, and filters MutationObserver actions 
 * to handle dynamically loaded content without crashing the layout threads.
 */
export class DomManager {
  private scene: Phaser.Scene;
  private domBodies: IDomBody[] = [];
  private observer: MutationObserver | null = null;
  private isScanning: boolean = false;
  private debounceTimer: any = null;
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Initializes the manager, performs the initial screen scan, binds window resizing hook, 
   * and registers the MutationObserver.
   */
  public init() {
    this.scanDomElements();
    window.addEventListener('resize', this.onResize);

    // Setup MutationObserver to watch for dynamically added DOM elements (lazy load, infinite scroll, etc).
    // This allows the snake to eat contents loaded dynamically as the user scrolls.
    this.observer = new MutationObserver((mutations) => {
      // Prevent loop: skip processing if we are currently modifying the DOM during scan/split operations.
      if (this.isScanning) return;
      
      let shouldRescan = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          // Prevent infinite reflow loops: ignore nodes that were added by the scanner itself (.edible-char).
          // Only trigger a full rescan if third-party layout elements were added to the DOM.
          const hasExternalNodes = Array.from(mutation.addedNodes).some(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const el = node as HTMLElement;
              return !el.classList.contains('edible-char') && !el.closest('.edible-char');
            }
            return true;
          });
          
          if (hasExternalNodes) {
            shouldRescan = true;
            break;
          }
        }
      }

      if (shouldRescan) {
        // Debounce rescan to prevent main thread freezing during active layout mutations
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
          this.observer?.disconnect();
          this.scanDomElements();
          this.observer?.observe(document.body, { childList: true, subtree: true });
        }, 800);
      }
    });

    this.observer.observe(document.body, { childList: true, subtree: true });

    // Ensure clean closure on scene changes or restarts to prevent ghost listeners.
    this.scene.sys.game.events.once('destroy', () => this.destroy());
    this.scene.events.once('shutdown', () => this.destroy());
  }

  /**
   * Callback executed when the browser window is resized.
   * Forces a fresh tree scan and updates all coordinate rectangles.
   */
  private onResize = () => {
    this.scanDomElements();
    this.updatePositions();
  }

  /**
   * Performs a comprehensive DOM scan.
   * Dynamically resolves the game container shell, passing it to the scanner 
   * to ensure the game container itself is excluded from eating loops.
   */
  private scanDomElements() {
    this.isScanning = true;
    try {
      const gameCanvas = this.scene.game?.canvas || null;
      // Dynamically locate the game container to exclude it from DOM eating.
      // Checks for custom React containers, falling back to the canvas's physical parent wrapper.
      const gameContainer = document.getElementById('phaser-game-container') || 
                            document.getElementById('game-container-shell') || 
                            (gameCanvas ? gameCanvas.parentElement : null);
      this.domBodies = DomScanner.scan(window.scrollX, window.scrollY, gameCanvas, gameContainer);
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Updates coordinates of all active elements.
   * Required when the page layout reflows or is scrolled to ensure 
   * coordinate parity between Phaser world space and DOM bounding boxes.
   */
  public updatePositions() {
    this.domBodies.forEach(item => {
      if (!item.hasBeenEaten) {
        const rect = item.element.getBoundingClientRect();
        item.body.setTo(rect.left + window.scrollX, rect.top + window.scrollY, rect.width, rect.height);
      }
    });
  }

  /**
   * Checks if the snake's head overlaps with any scanned DOM element.
   * Returns a list of all collided elements.
   * 
   * @param headRect Phaser boundary rectangle representing the snake's head
   */
  public checkCollisions(headRect: Phaser.Geom.Rectangle): IDomBody[] {
    const hits: IDomBody[] = [];
    const newBodies: IDomBody[] = [];

    // Create an expanded bounding box for checking textContainer proximity
    const buffer = 100; // split text container when snake is within 100px
    const proximityRect = new Phaser.Geom.Rectangle(
      headRect.x - buffer,
      headRect.y - buffer,
      headRect.width + buffer * 2,
      headRect.height + buffer * 2
    );

    // Filter elements vertically close to the snake's head to optimize long scrollable pages
    const minY = headRect.y - 400;
    const maxY = headRect.y + 400;

    for (const item of this.domBodies) {
      if (item.hasBeenEaten) continue;

      // Skip elements that are vertically far away from the head to avoid expensive intersection checks
      if (item.body.y < minY || item.body.y > maxY) continue;

      if (item.type === 'textContainer') {
        // Check proximity intersection
        if (Phaser.Geom.Intersects.RectangleToRectangle(item.body, proximityRect)) {
          item.hasBeenEaten = true; // prevent double splitting
          this.splitTextContainer(item, newBodies);
        }
      } else {
        // Standard precise collision
        if (Phaser.Geom.Intersects.RectangleToRectangle(item.body, headRect)) {
          item.hasBeenEaten = true;
          hits.push(item);
        }
      }
    }

    if (newBodies.length > 0) {
      this.domBodies.push(...newBodies);
    }

    return hits;
  }

  /**
   * Dynamically splits a text container into character spans and registers them in our active collision list.
   */
  private splitTextContainer(item: IDomBody, newBodies: IDomBody[]) {
    const el = item.element;
    if (!el) return;

    // Split the element's text nodes into individual character spans
    DomScanner.splitElementIntoSpans(el);

    // Retrieve the newly created spans
    const chars = el.querySelectorAll('.edible-char');
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    chars.forEach((charEl, idx) => {
      const htmlCharEl = charEl as HTMLElement;
      // Skip if already eaten
      if (htmlCharEl.dataset.eaten === 'true') return;

      const rect = htmlCharEl.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        newBodies.push({
          element: htmlCharEl,
          body: new Phaser.Geom.Rectangle(rect.left + scrollX, rect.top + scrollY, rect.width, rect.height),
          id: `char-lazy-${item.id}-${idx}`,
          hasBeenEaten: false,
          type: 'char'
        });
      }
    });
  }
  
  /**
   * Forwards eat requests to DomAnimator to trigger custom transition profiles.
   */
  public eatElement(item: IDomBody) {
    DomAnimator.animateEat(item, this.domBodies);
  }

  /**
   * Helper function to dynamically add elements to the tracking list.
   */
  public addBody(body: IDomBody) {
    this.domBodies.push(body);
  }

  /**
   * Returns the count of remaining edible DOM elements.
   */
  public getRemainingCount() {
    return this.domBodies.filter(i => !i.hasBeenEaten).length;
  }

  /**
   * Clean up event listeners and MutationObservers to avoid memory leaks.
   */
  public destroy() {
    window.removeEventListener('resize', this.onResize);
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}
