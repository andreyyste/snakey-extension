import Phaser from 'phaser';
import { IDomBody } from './DomManager';

/**
 * DomScanner is responsible for analyzing the HTML Document Object Model (DOM).
 * It runs recursive tree-walking passes to split plain text content into individual 
 * edible characters, detects interactive media elements, identifies visual card layouts, 
 * and maps all coordinates into Phaser Geom bounds.
 */
export class DomScanner {
  // A standard list of HTML tags that represent interactive, media, or structure elements 
  // which will trigger unique custom chomp animations when eaten.
  private static targetSelector = 'img, svg, video, input, textarea, button, a, select, progress, meter, canvas, hr, iframe, audio';

  /**
   * Main scan function executed to refresh the world of edible elements.
   * Runs in two phases:
   * 1. Finds all text nodes and splits them into span characters.
   * 2. Walk the tree to collect those characters, cards, and target elements.
   * 
   * @param scrollX Current viewport horizontal scroll offset (to convert screen relative positions to absolute Phaser coordinates)
   * @param scrollY Current viewport vertical scroll offset
   * @param gameCanvas Active Phaser game canvas element to exclude from scan
   * @param gameContainer Parent wrapper element of the Phaser game to exclude
   */
  public static scan(scrollX: number, scrollY: number, gameCanvas: HTMLCanvasElement | null = null, gameContainer: HTMLElement | null = null): IDomBody[] {
    const domBodies: IDomBody[] = [];

    // In lazy-splitting mode, we do NOT run the first pass of splitting all text nodes.
    // Instead, we directly collect edible elements (including unsplit text containers).
    this.collectEdibleElements(document.body, scrollX, scrollY, domBodies, gameCanvas, gameContainer);

    return domBodies;
  }

  /**
   * Evaluates if a DOM element should be excluded from scanning and gameplay.
   * Excludes the game canvas, game container, scripts/styles, and already eaten nodes.
   * Also excludes full-screen fixed overlays (backdrops, modals) to prevent the snake 
   * from being boxed in or blocked by non-interactive layout shells.
   * 
   * @param isTextScan Set to true when called during text parsing to prevent parsing already split spans
   */
  private static isExcludedElement(el: HTMLElement, gameCanvas: HTMLCanvasElement | null, gameContainer: HTMLElement | null, isTextScan: boolean = false): boolean {
    if (el === gameCanvas || el === gameContainer) return true;
    if (gameContainer && gameContainer.contains(el)) return true;
    if (el.dataset.eaten === 'true' || el.closest('[data-eaten="true"]')) return true;

    const tagName = el.tagName.toLowerCase();
    if (tagName === 'script' || tagName === 'style' || tagName === 'noscript') {
      return true;
    }

    if (isTextScan) {
      // Prevents infinite loops: do not scan text nodes that are already children of our injected character spans.
      if (el.classList.contains('edible-char') || el.closest('.edible-char')) {
        return true;
      }
    }

    // Dynamic full-screen fixed overlay check (like backdrops, modal overlays)
    // Ensures that full-screen fixed layout shields on general websites don't act as giant physical blocks.
    const style = window.getComputedStyle(el);
    if (style.position === 'fixed') {
      const rect = el.getBoundingClientRect();
      if (rect.width >= window.innerWidth * 0.9 && rect.height >= window.innerHeight * 0.9) {
        return true;
      }
    }

    return false;
  }

  /**
   * Recursively walks the DOM tree to locate all valid text nodes containing renderable characters.
   * Traverses into elements, element children, and Shadow DOM boundaries.
   */
  public static findTextNodes(node: Node, result: Text[], gameCanvas: HTMLCanvasElement | null = null, gameContainer: HTMLElement | null = null) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.nodeValue && node.nodeValue.trim()) {
        const parent = node.parentNode as HTMLElement;
        // Verify parent element isn't marked for exclusion before registering its text.
        if (parent && !parent.closest('script, style, noscript, .edible-char, [data-eaten="true"]')) {
          if (gameContainer && gameContainer.contains(parent)) return;
          result.push(node as Text);
        }
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (this.isExcludedElement(el, gameCanvas, gameContainer, true)) return;
      
      // Ignore hidden or zero-opacity layout nodes to prevent invisible block collisions.
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) return;

      el.childNodes.forEach(child => this.findTextNodes(child, result, gameCanvas, gameContainer));
      if (el.shadowRoot) {
        el.shadowRoot.childNodes.forEach(child => this.findTextNodes(child, result, gameCanvas, gameContainer));
      }
    }
  }

  /**
   * Replaces a single text node with a document fragment containing individual spans 
   * for each character. This allows the snake to eat text letter-by-letter.
   */
  public static replaceTextNodeWithSpans(textNode: Text, splitByLetters: boolean = false) {
    const text = textNode.nodeValue || '';
    const parent = textNode.parentNode;
    if (!parent) return;

    const fragment = document.createDocumentFragment();
    let hasValidContent = false;

    if (splitByLetters) {
      // Split character-by-character for large fonts / headings
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char.trim() === '') {
          fragment.appendChild(document.createTextNode(char));
        } else {
          const span = document.createElement('span');
          span.textContent = char;
          span.className = 'edible-char';
          span.style.transition = 'all 0.3s ease';
          span.style.display = 'inline-block';
          fragment.appendChild(span);
          hasValidContent = true;
        }
      }
    } else {
      // Split word-by-word for standard body text (saves performance)
      const words = text.split(/(\s+)/);
      words.forEach(part => {
        if (part.trim() === '') {
          fragment.appendChild(document.createTextNode(part));
        } else {
          const span = document.createElement('span');
          span.textContent = part;
          span.className = 'edible-char';
          span.style.transition = 'all 0.3s ease';
          span.style.display = 'inline-block';
          fragment.appendChild(span);
          hasValidContent = true;
        }
      });
    }

    if (hasValidContent) {
      parent.replaceChild(fragment, textNode);
    }
  }

  /**
   * Style-based card detection heuristic to identify card/block layout components dynamically.
   * Checks if an element has non-trivial boundaries (shadows, borders, or distinct backgrounds).
   * This is decoupled from class names to ensure compatibility with any website.
   */
  private static isCardElement(el: HTMLElement, style: CSSStyleDeclaration, rect: DOMRect): boolean {
    if (el === document.body || el === document.documentElement || el.id === 'root') return false;
    
    // Exclude elements matching targetSelector because they are interactive leaf nodes 
    // and have their own distinct animation profiles.
    if (el.matches(this.targetSelector)) return false;
    
    // Size check: must be at least a small block element (like an icon wrapper, badge, or card).
    // Allows micro-elements like status badges to be eaten as cards.
    if (rect.width < 12 || rect.height < 12) return false;
    
    // Exclude large full-viewport layout sections/wrappers to prevent trapping the snake inside grid shells.
    if (rect.width >= window.innerWidth * 0.9 || rect.height >= window.innerHeight * 0.9) return false;

    // 1. Box shadow (standard visual boundary for modern cards)
    const hasShadow = style.boxShadow !== 'none' && style.boxShadow !== '';
    // 2. Visible border
    const hasBorder = style.borderStyle !== 'none' && style.borderWidth !== '0px' && style.borderColor !== 'transparent';
    // 3. Different background color from transparent
    const hasBg = style.backgroundColor !== 'transparent' && style.backgroundColor !== 'rgba(0, 0, 0, 0)';

    return hasShadow || hasBorder || hasBg;
  }

  /**
   * Traverses the DOM recursively to locate and collect characters, cards, and media elements.
   * Converts viewport coordinates into absolute world coordinates and adds items to domBodies list.
   */
  private static collectEdibleElements(node: Node, scrollX: number, scrollY: number, domBodies: IDomBody[], gameCanvas: HTMLCanvasElement | null = null, gameContainer: HTMLElement | null = null) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (this.isExcludedElement(el, gameCanvas, gameContainer, false)) return;

      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) return;

      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        // Check if it is a split character
        if (el.classList.contains('edible-char')) {
          domBodies.push({
            element: el,
            body: new Phaser.Geom.Rectangle(rect.left + scrollX, rect.top + scrollY, rect.width, rect.height),
            id: `char-${domBodies.length}`,
            hasBeenEaten: false,
            type: 'char'
          });
        }
        // Check if it is a text container that hasn't been split yet
        else if (this.hasUnsplitDirectText(el)) {
          domBodies.push({
            element: el,
            body: new Phaser.Geom.Rectangle(rect.left + scrollX, rect.top + scrollY, rect.width, rect.height),
            id: `text-container-${domBodies.length}`,
            hasBeenEaten: false,
            type: 'textContainer'
          });
        }
        // Check if it is a card container (exclude from targetSelector matching to prevent duplicate collisions)
        else if (this.isCardElement(el, style, rect)) {
          if (el.dataset.cardEaten !== 'true') {
            this.addCardWalls(el, rect, scrollX, scrollY, domBodies);
          }
        }
        // Check if it is a media or other interactive element
        else if (el.matches(this.targetSelector)) {
          // Add transition if not already set
          if (!el.style.transition) {
            el.style.transition = 'all 0.3s ease';
          }
          domBodies.push({
            element: el,
            body: new Phaser.Geom.Rectangle(rect.left + scrollX, rect.top + scrollY, rect.width, rect.height),
            id: `media-${domBodies.length}`,
            hasBeenEaten: false,
            type: 'media'
          });
        }
      }

      // Recurse into children
      el.childNodes.forEach(child => this.collectEdibleElements(child, scrollX, scrollY, domBodies, gameCanvas, gameContainer));
      // Recurse into shadow DOM
      if (el.shadowRoot) {
        el.shadowRoot.childNodes.forEach(child => this.collectEdibleElements(child, scrollX, scrollY, domBodies, gameCanvas, gameContainer));
      }
    }
  }

  /**
   * Adds four physical wall segments around the bounding rectangle of a card element.
   * This creates a physical obstacle that the snake must eat through.
   */
  private static addCardWalls(card: HTMLElement, rect: DOMRect, scrollX: number, scrollY: number, domBodies: IDomBody[]) {
    const ax = rect.left + scrollX;
    const ay = rect.top + scrollY;
    const w = rect.width;
    const h = rect.height;
    
    // Scale wall thickness dynamically with container size, capping between 4px and 15px.
    // This prevents small badges/icon boxes from having overlapping massive walls.
    const thick = Math.max(4, Math.min(15, w / 4, h / 4));
    
    if (!card.style.transition) {
      card.style.transition = 'all 0.5s ease';
    }
    
    const walls = [
      new Phaser.Geom.Rectangle(ax, ay, w, thick),
      new Phaser.Geom.Rectangle(ax, ay + h - thick, w, thick),
      new Phaser.Geom.Rectangle(ax, ay, thick, h),
      new Phaser.Geom.Rectangle(ax + w - thick, ay, thick, h),
    ];
    
    walls.forEach((wall, wIdx) => {
      domBodies.push({
        element: card,
        body: wall,
        id: `card-${card.id || 'unnamed'}-wall-${wIdx}`,
        hasBeenEaten: false,
        type: 'cardWall'
      });
    });
  }

  /**
   * Adds four physical walls around the game shell/canvas container.
   * These act as the boundary of the normal game phase.
   */
  private static addGameShellWalls(scrollX: number, scrollY: number, domBodies: IDomBody[], gameContainer: HTMLElement | null = null) {
    const container = gameContainer || document.getElementById('game-container-shell');
    if (container) {
      const rect = container.getBoundingClientRect();
      const ax = rect.left + scrollX;
      const ay = rect.top + scrollY;
      const w = rect.width;
      const h = rect.height;
      const thick = 15;
      
      container.style.transition = 'all 0.5s ease';
      
      const walls = [
        new Phaser.Geom.Rectangle(ax, ay, w, thick),
        new Phaser.Geom.Rectangle(ax, ay + h - thick, w, thick),
        new Phaser.Geom.Rectangle(ax, ay, thick, h),
        new Phaser.Geom.Rectangle(ax + w - thick, ay, thick, h),
      ];
      
      walls.forEach((wall, idx) => {
        domBodies.push({
          element: container,
          body: wall,
          id: `wall-${idx}`,
          hasBeenEaten: false,
          type: 'wall'
        });
      });
    }
  }

  /**
   * Helper to split an element's text nodes into individual edible character spans.
   */
  public static splitElementIntoSpans(el: HTMLElement) {
    const style = window.getComputedStyle(el);
    const fontSize = parseFloat(style.fontSize) || 16;
    // Split by letters if it is a heading or has a large font size (>= 20px)
    const splitByLetters = el.matches('h1, h2, h3, h4, h5, h6') || fontSize >= 20;

    const textNodes: Text[] = [];
    DomScanner.findTextNodes(el, textNodes);
    textNodes.forEach(textNode => {
      DomScanner.replaceTextNodeWithSpans(textNode, splitByLetters);
    });
  }

  /**
   * Checks if an element contains direct unsplit text node content.
   */
  private static hasUnsplitDirectText(el: HTMLElement): boolean {
    if (el.classList.contains('edible-char') || el.closest('.edible-char')) return false;

    // Check if it contains direct text nodes with content
    const hasText = Array.from(el.childNodes).some(n => 
      n.nodeType === Node.TEXT_NODE && 
      n.nodeValue && 
      n.nodeValue.trim() !== ''
    );
    if (!hasText) return false;

    // Check if it doesn't already contain split character spans
    return el.querySelector('.edible-char') === null;
  }
}
