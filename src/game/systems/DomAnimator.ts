import { IDomBody } from './DomManager';

/**
 * DomAnimator is responsible for executing visual animations on HTML DOM elements 
 * when they are eaten by the snake.
 * 
 * It supports standard CSS transitions, tag-specific custom animations (e.g. checkbox toggles, 
 * inputs vibration, select dropdown expansion, media playback fast-forward), 
 * and universal layout card collapsing.
 */
export class DomAnimator {
  // We keep track of all active intervals and timeouts so we can cleanly terminate them 
  // on scene resets or shutdowns. This prevents memory leaks and callback triggers 
  // on unmounted or restored elements.
  private static activeIntervals = new Set<any>();
  private static activeTimeouts = new Set<any>();

  /**
   * Clears all running intervals and timeouts registered by this animator.
   * This is critical to call when the game is restarted or destroyed to prevent memory leaks 
   * and callbacks running in the background after the elements have been restored.
   */
  public static clearAll() {
    this.activeIntervals.forEach(id => clearInterval(id));
    this.activeIntervals.clear();
    this.activeTimeouts.forEach(id => clearTimeout(id));
    this.activeTimeouts.clear();
  }

  /**
   * Triggers the eating animation for a DOM element.
   * Identifies the type of element and selects the appropriate transition profile.
   * 
   * @param item The element model being eaten
   * @param domBodies The master list of scanned DOM elements (used to flag child nodes as eaten)
   */
  public static animateEat(item: IDomBody, domBodies: IDomBody[]) {
    if (item.element) {
      if (item.type === 'cardWall') {
        item.element.dataset.cardEaten = 'true';
      } else {
        item.element.dataset.eaten = 'true';
      }
    }

    // Mark descendants as eaten to avoid "ghost" collisions, except for cardWall.
    // Eating a container (like a paragraph or layout section) automatically absorbs 
    // its child contents to prevent double collisions and visual clutter.
    if (item.element && item.type !== 'cardWall') {
      domBodies.forEach(b => {
        if (!b.hasBeenEaten && b !== item && item.element.contains(b.element)) {
          b.hasBeenEaten = true;
          if (b.element) {
            b.element.dataset.eaten = 'true';
          }
          b.element.style.transform = 'scale(0)';
          b.element.style.opacity = '0';
        }
      });
    }

    const el = item.element;
    if (!el) return;

    if (item.type === 'wall') {
      // Game container outer boundary chomp effect (spins and scale out)
      el.style.transform = 'scale(0) rotate(90deg)';
      el.style.opacity = '0';
      // Mark all wall segments of this container as eaten to avoid duplicate animations
      domBodies
        .filter(b => b.type === 'wall' && b.element === el)
        .forEach(b => (b.hasBeenEaten = true));
    } else if (item.type === 'cardWall') {
      // Card container wall chomped -> collapse its dynamic background wrapper
      DomAnimator.setupDynamicCardBackground(el);
      
      const bgDiv = el.querySelector('.dynamic-card-bg') as HTMLElement;
      if (bgDiv) {
        // Force a style recalculation/reflow to ensure transitions run correctly
        bgDiv.getBoundingClientRect();
        bgDiv.style.transform = 'scale(0) rotate(15deg)';
        bgDiv.style.opacity = '0';
      }
      
      // Mark all wall segments of this card as eaten
      domBodies
        .filter(b => b.type === 'cardWall' && b.element === el)
        .forEach(b => (b.hasBeenEaten = true));
    } else if (item.type === 'finalTarget') {
      el.style.transform = 'scale(0) rotate(180deg)';
      el.style.opacity = '0';
      const timeoutId = setTimeout(() => {
        el.style.visibility = 'hidden';
        DomAnimator.activeTimeouts.delete(timeoutId);
      }, 500);
      DomAnimator.activeTimeouts.add(timeoutId);
    } else {
      // Tag-specific custom animations for different elements
      const tagName = el.tagName.toLowerCase();

      if (tagName === 'select') {
        const select = el as HTMLSelectElement;
        // Expand the dropdown list visually to simulate it opening, then scale out
        select.size = Math.max(select.options.length, 3);
        select.style.transform = 'scale(1.05)';
        
        const timeoutId1 = setTimeout(() => {
          select.style.transition = 'all 0.5s ease';
          select.style.transform = 'scale(0) rotate(90deg)';
          select.style.opacity = '0';
          const timeoutId2 = setTimeout(() => {
            select.style.visibility = 'hidden';
            DomAnimator.activeTimeouts.delete(timeoutId2);
          }, 500);
          DomAnimator.activeTimeouts.add(timeoutId2);
          DomAnimator.activeTimeouts.delete(timeoutId1);
        }, 300);
        DomAnimator.activeTimeouts.add(timeoutId1);
      } 
      else if (tagName === 'hr') {
        // Shrink horizontally to 0 width
        el.style.transition = 'transform 0.4s ease, opacity 0.4s ease';
        el.style.transform = 'scaleX(0)';
        el.style.opacity = '0';
      } 
      else if (tagName === 'progress' || tagName === 'meter') {
        const prog = el as HTMLProgressElement | HTMLMeterElement;
        // Drain the progress/meter bar value down to 0 in increments before scaling out
        const startVal = prog.value;
        let currentVal = startVal;
        const steps = 10;
        const interval = 20; // 200ms total drain duration
        const stepVal = startVal / steps;
        
        const drain = setInterval(() => {
          currentVal -= stepVal;
          if (currentVal <= 0) {
            clearInterval(drain);
            DomAnimator.activeIntervals.delete(drain);
            prog.value = 0;
            prog.style.transform = 'scale(0) rotate(180deg)';
            prog.style.opacity = '0';
          } else {
            prog.value = currentVal;
          }
        }, interval);
        DomAnimator.activeIntervals.add(drain);
      } 
      else if (tagName === 'input' && ((el as HTMLInputElement).type === 'checkbox' || (el as HTMLInputElement).type === 'radio')) {
        const input = el as HTMLInputElement;
        // Toggle rapidly to simulate a frantic click interaction, then scale out
        let count = 0;
        const toggle = setInterval(() => {
          input.checked = !input.checked;
          count++;
          if (count >= 6) {
            clearInterval(toggle);
            DomAnimator.activeIntervals.delete(toggle);
            input.style.transform = 'scale(0)';
            input.style.opacity = '0';
          }
        }, 50);
        DomAnimator.activeIntervals.add(toggle);
      }
      else if (tagName === 'input' || tagName === 'textarea') {
        // Shaking/vibrating translation effect before shrinking
        let offset = 0;
        const vibrate = setInterval(() => {
          offset = offset === 0 ? 5 : 0;
          el.style.transform = `translateX(${offset}px)`;
        }, 50);
        DomAnimator.activeIntervals.add(vibrate);
        
        const timeoutId1 = setTimeout(() => {
          clearInterval(vibrate);
          DomAnimator.activeIntervals.delete(vibrate);
          el.style.transition = 'all 0.4s ease';
          el.style.transform = 'scale(0) rotate(-45deg)';
          el.style.opacity = '0';
          const timeoutId2 = setTimeout(() => {
            el.style.visibility = 'hidden';
            DomAnimator.activeTimeouts.delete(timeoutId2);
          }, 400);
          DomAnimator.activeTimeouts.add(timeoutId2);
          DomAnimator.activeTimeouts.delete(timeoutId1);
        }, 400);
        DomAnimator.activeTimeouts.add(timeoutId1);
      }
      else if (tagName === 'iframe') {
        // Spin and fall down the screen
        el.style.transition = 'transform 0.8s ease-in, opacity 0.8s ease-in';
        el.style.transform = 'translateY(150px) rotate(360deg) scale(0)';
        el.style.opacity = '0';
      }
      else if (tagName === 'video' || tagName === 'audio') {
        const media = el as HTMLVideoElement | HTMLAudioElement;
        // Fast forward play rate and fade out volume if media is active, then scale out
        try {
          if (!media.paused) {
            media.playbackRate = 3.0;
            let vol = media.volume;
            const fade = setInterval(() => {
              vol = Math.max(0, vol - 0.1);
              media.volume = vol;
              if (vol <= 0) {
                clearInterval(fade);
                DomAnimator.activeIntervals.delete(fade);
                media.pause();
              }
            }, 30);
            DomAnimator.activeIntervals.add(fade);
          }
        } catch (e) {
          // Ignore potential browser safety restrictions on volume/playbackRate updates
        }
        el.style.transform = 'scale(0) rotate(-180deg)';
        el.style.opacity = '0';
      }
      else {
        // Default character/leaf animation (spins, moves upward, and shrinks)
        el.style.transform = 'scale(0) translateY(-20px) rotate(180deg)';
        el.style.opacity = '0';
        const timeoutId = setTimeout(() => {
          el.style.visibility = 'hidden';
          DomAnimator.activeTimeouts.delete(timeoutId);
        }, 500);
        DomAnimator.activeTimeouts.add(timeoutId);
      }
    }
  }

  /**
   * Lazily clones and isolates a card container's background layout.
   * Copies shadow, border, background, and border-radius styles onto a dynamically injected absolute child div, 
   * and sets the parent card's own styles to transparent.
   * This is done so that we can transition the background div (rotate and scale to 0) 
   * without affecting the coordinates, alignment, or text visibility of child elements.
   */
  private static setupDynamicCardBackground(el: HTMLElement) {
    if (el.dataset.hasDynamicBg === 'true') return;

    const style = window.getComputedStyle(el);
    
    // Save original visual style values in dataset attributes.
    // This allows SnakeScene's restoreCanvas to return the website's original layout flawlessly.
    el.dataset.origBg = el.style.background;
    el.dataset.origBgColor = el.style.backgroundColor;
    el.dataset.origBgImage = el.style.backgroundImage;
    el.dataset.origShadow = el.style.boxShadow;
    el.dataset.origPosition = el.style.position;
    
    // Backup detailed border metrics
    el.dataset.origBorderTop = el.style.borderTop;
    el.dataset.origBorderRight = el.style.borderRight;
    el.dataset.origBorderBottom = el.style.borderBottom;
    el.dataset.origBorderLeft = el.style.borderLeft;
    el.dataset.origBorderRadius = el.style.borderRadius;

    // Create the background wrapper element
    const bgDiv = document.createElement('div');
    bgDiv.className = 'dynamic-card-bg';
    
    // Apply styling to align exactly with the parent card bounds behind text content
    bgDiv.style.position = 'absolute';
    bgDiv.style.top = '0';
    bgDiv.style.left = '0';
    bgDiv.style.width = '100%';
    bgDiv.style.height = '100%';
    bgDiv.style.zIndex = '-1';
    bgDiv.style.boxSizing = 'border-box';
    bgDiv.style.pointerEvents = 'none';

    // Copy visual colors, assets, shadows, and borders
    bgDiv.style.background = style.background || style.backgroundColor;
    bgDiv.style.backgroundImage = style.backgroundImage;
    bgDiv.style.boxShadow = style.boxShadow;
    
    // Clone individual border lines
    bgDiv.style.borderTop = style.borderTop;
    bgDiv.style.borderRight = style.borderRight;
    bgDiv.style.borderBottom = style.borderBottom;
    bgDiv.style.borderLeft = style.borderLeft;
    
    // Clone corner rounding metrics
    bgDiv.style.borderTopLeftRadius = style.borderTopLeftRadius;
    bgDiv.style.borderTopRightRadius = style.borderTopRightRadius;
    bgDiv.style.borderBottomLeftRadius = style.borderBottomLeftRadius;
    bgDiv.style.borderBottomRightRadius = style.borderBottomRightRadius;

    // Apply scale/rotation transition parameters
    bgDiv.style.transition = 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.6s ease';

    // Ensure relative positioning on parent card so the absolute background child anchors correctly.
    if (style.position === 'static') {
      el.style.position = 'relative';
    }

    // Insert as the first child of the card so it renders beneath text and media elements.
    el.insertBefore(bgDiv, el.firstChild);

    // Make parent card styles transparent so only the dynamic background element renders the boundary.
    el.style.background = 'transparent';
    el.style.backgroundColor = 'transparent';
    el.style.backgroundImage = 'none';
    el.style.boxShadow = 'none';
    el.style.borderTop = 'none';
    el.style.borderRight = 'none';
    el.style.borderBottom = 'none';
    el.style.borderLeft = 'none';

    el.dataset.hasDynamicBg = 'true';
  }
}
