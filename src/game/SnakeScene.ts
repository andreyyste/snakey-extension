import Phaser from 'phaser';
import { GRID_SIZE, MOVE_INTERVAL } from './constants';
import { AudioManager } from './systems/AudioManager';
import { GameUI } from './ui/GameUI';
import { Snake } from './core/Snake';
import { Food } from './core/Food';
import { DomManager } from './systems/DomManager';
import { InputManager } from './systems/InputManager';
import { DomAnimator } from './systems/DomAnimator';

/**
 * SnakeScene represents the primary Phaser 3 scene containing the game loop, 
 * graphics preloading, coordinate translations, game state transitions, 
 * and DOM chomp orchestration.
 */
export class SnakeScene extends Phaser.Scene {
  private snake!: Snake;
  private food!: Food;
  private audioManager!: AudioManager;
  private gameUI!: GameUI;
  private domManager!: DomManager;
  private inputManager!: InputManager;

  private moveTimer: number = 0;
  private score: number = 0;
  private isGameOver: boolean = false;
  private isEscaped: boolean = false;
  private finalPhaseStarted: boolean = false;

  constructor() {
    super('SnakeScene');
  }

  /**
   * Preloads textures and dynamic textures.
   * Generates procedural pixel graphics on the fly to avoid asset dependency lags.
   */
  preload() {
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });
    const factor = 5;
    const gs = GRID_SIZE * factor;

    // Procedural snake body texture
    graphics.fillStyle(0x3b82f6, 1);
    graphics.fillRoundedRect(1 * factor, 1 * factor, gs - 2 * factor, gs - 2 * factor, 4 * factor);
    graphics.generateTexture('snake-body', gs, gs);

    // Procedural snake head texture (with eyes)
    graphics.clear();
    graphics.fillStyle(0x1d4ed8, 1);
    graphics.fillRoundedRect(1 * factor, 1 * factor, gs - 2 * factor, gs - 2 * factor, 6 * factor);
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(gs - 5 * factor, 6 * factor, 2 * factor);
    graphics.fillCircle(gs - 5 * factor, gs - 6 * factor, 2 * factor);
    graphics.generateTexture('snake-head', gs, gs);

    // Procedural normal food texture
    graphics.clear();
    graphics.fillStyle(0xef4444, 1);
    graphics.fillCircle(gs / 2, gs / 2, gs / 2 - 2 * factor);
    graphics.generateTexture('food', gs, gs);

    // Procedural special escape pill texture
    graphics.clear();
    graphics.fillStyle(0x000000, 1);
    graphics.fillRoundedRect(gs / 4, gs / 4, gs / 2, gs / 2, 4 * factor);
    graphics.fillStyle(0xff0000, 1);
    graphics.fillRoundedRect(gs / 4 + 2 * factor, gs / 4 + 2 * factor, gs / 2 - 4 * factor, gs / 2 - 4 * factor, 2 * factor);
    graphics.generateTexture('special-food', gs, gs);
  }

  /**
   * Initializes sub-managers, cores, scene events, and starts window event bindings.
   */
  create() {
    this.isEscaped = true;
    this.isGameOver = false;
    this.finalPhaseStarted = false;
    this.score = 0;
    this.moveTimer = 0;

    // Direct fixed viewport overlay styling for Chrome Extension
    const canvas = this.game.canvas;
    document.body.appendChild(canvas);
    canvas.style.position = 'fixed';
    canvas.style.top = '0px';
    canvas.style.left = '0px';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.zIndex = '999999';
    canvas.style.pointerEvents = 'none';

    this.scale.resize(window.innerWidth, window.innerHeight);

    if (this.cameras && this.cameras.main) {
      this.cameras.main.scrollX = window.scrollX;
      this.cameras.main.scrollY = window.scrollY;
    }

    this.audioManager = new AudioManager();
    this.audioManager.init();

    // Spawn snake centered in the active viewport
    const offset = GRID_SIZE / 2;
    const startX = Math.floor((window.scrollX + window.innerWidth / 2) / GRID_SIZE) * GRID_SIZE + offset;
    const startY = Math.floor((window.scrollY + window.innerHeight / 2) / GRID_SIZE) * GRID_SIZE + offset;

    this.snake = new Snake(this);
    this.snake.create(startX, startY);

    this.food = new Food(this);
    this.food.create();
    this.food.hide();

    this.domManager = new DomManager(this);
    this.domManager.init();

    this.inputManager = new InputManager(this, this.audioManager);

    this.gameUI = new GameUI(this);
    this.gameUI.create();

    // Automatically invoke restoration logic if the scene is shutdown or destroyed 
    // to prevent visual glitches and memory leak carries.
    this.sys.game.events.once('destroy', this.onDestroy);
    this.events.once('shutdown', this.onShutdown);
    window.addEventListener('scroll', this.handleScroll);
  }

  private onDestroy = () => {
    window.removeEventListener('scroll', this.handleScroll);
    this.restoreCanvas();
  }

  private onShutdown = () => {
    window.removeEventListener('scroll', this.handleScroll);
    this.restoreCanvas();
  }

  /**
   * Restores the HTML document layout and style rules to their original values.
   * - Moves the Phaser canvas element back inside the game wrapper container.
   * - Removes all full-screen fixed styling from the canvas.
   * - Resizes the scale manager back to the standard 800x600 layout.
   * - Removes all dynamically injected background divs (.dynamic-card-bg).
   * - Reads backup original styles from DOM elements dataset properties and restores them.
   */
  private restoreCanvas() {
    this.isEscaped = false;
    this.isGameOver = false;

    const canvas = this.game.canvas;
    const container = document.getElementById('phaser-game-container');
    if (container) {
      container.appendChild(canvas);
    } else {
      const shell = document.getElementById('game-container-shell');
      if (shell) {
        shell.appendChild(canvas);
      }
    }

    // Reset canvas inline styles to let them fall back to stylesheet defaults
    canvas.style.position = '';
    canvas.style.top = '';
    canvas.style.left = '';
    canvas.style.width = '';
    canvas.style.height = '';
    canvas.style.zIndex = '';
    canvas.style.pointerEvents = '';

    // Reset camera scroll
    if (this.cameras && this.cameras.main) {
      this.cameras.main.scrollX = 0;
      this.cameras.main.scrollY = 0;
    }

    this.scale.resize(800, 600);

    if (this.domManager) {
      this.domManager.destroy();
    }

    // Terminate all pending background animations and timer loops
    DomAnimator.clearAll();

    // Restore DOM elements styles and clean up dynamic backgrounds
    const eatenElements = document.querySelectorAll('[data-eaten], [data-card-eaten], [data-has-dynamic-bg]');
    eatenElements.forEach((node) => {
      const el = node as HTMLElement;
      el.style.transform = '';
      el.style.opacity = '';
      el.style.visibility = '';
      el.style.transition = '';
      
      // If it had a dynamic background set up, restore its original styles from backup datasets
      if (el.dataset.hasDynamicBg === 'true') {
        el.style.background = el.dataset.origBg || '';
        el.style.backgroundColor = el.dataset.origBgColor || '';
        el.style.backgroundImage = el.dataset.origBgImage || '';
        el.style.boxShadow = el.dataset.origShadow || '';
        el.style.position = el.dataset.origPosition || '';
        el.style.borderTop = el.dataset.origBorderTop || '';
        el.style.borderRight = el.dataset.origBorderRight || '';
        el.style.borderBottom = el.dataset.origBorderBottom || '';
        el.style.borderLeft = el.dataset.origBorderLeft || '';
        el.style.borderRadius = el.dataset.origBorderRadius || '';

        // Delete style backup attributes
        delete el.dataset.hasDynamicBg;
        delete el.dataset.origBg;
        delete el.dataset.origBgColor;
        delete el.dataset.origBgImage;
        delete el.dataset.origShadow;
        delete el.dataset.origPosition;
        delete el.dataset.origBorderTop;
        delete el.dataset.origBorderRight;
        delete el.dataset.origBorderBottom;
        delete el.dataset.origBorderLeft;
        delete el.dataset.origBorderRadius;
      } else {
        el.style.background = '';
        el.style.borderColor = '';
        el.style.boxShadow = '';
      }

      delete el.dataset.eaten;
      delete el.dataset.cardEaten;
    });

    // Remove any dynamic card background elements from the DOM
    const dynamicBgs = document.querySelectorAll('.dynamic-card-bg');
    dynamicBgs.forEach((bg) => bg.remove());
  }

  /**
   * Tracks viewport scrolling during escape phase.
   * Automatically shifts the camera scroll viewport bounds to follow 
   * window scrolls if the player scrolls the page manually.
   */
  private handleScroll = () => {
    if (this.isEscaped && this.cameras.main) {
      this.cameras.main.scrollX = window.scrollX;
      this.cameras.main.scrollY = window.scrollY;
    }
  }

  update(time: number, delta: number) {
    if (this.isGameOver) {
      if (this.input.keyboard?.checkDown(this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE), 250)) {
        this.scene.restart();
      }
      return;
    }

    this.inputManager.handleInput(this.snake);

    this.moveTimer += delta;

    if (this.moveTimer >= MOVE_INTERVAL) {
      this.moveTimer -= MOVE_INTERVAL;
      this.processGameTick(MOVE_INTERVAL);
    }
  }

  /**
   * Triggers logical movements for each tick duration.
   * Decides which phase (normal vs escape) is active and runs colliders.
   */
  private processGameTick(duration: number) {
    const { dead, hitWall, newX, newY, tailOldX, tailOldY } = this.snake.move(duration, this.isEscaped);

    if (dead) {
      // If the snake is escaped and goes off the document scroll boundary, 
      // trigger the website-breaking final transition.
      if (this.isEscaped && hitWall) {
        this.triggerWebBroke();
      } else {
        this.isGameOver = true;
        this.audioManager.playDieSound();
        this.gameUI.showGameOver();
      }
      return;
    }

    if (this.isEscaped) {
      this.processEscapePhase(newX, newY, tailOldX, tailOldY);
    } else {
      this.processNormalPhase(newX, newY, tailOldX, tailOldY);
    }
  }

  /**
   * Physics loop for the standard gameplay.
   * Collision check against standard food coordinates inside the canvas.
   */
  private processNormalPhase(newX: number, newY: number, tailOldX: number, tailOldY: number) {
    if (this.food.checkCollision(newX, newY, this.snake.stepSize)) {
      this.score += 10;
      this.game.events.emit('score-update', this.score);
      this.audioManager.playEatSound();
      
      this.snake.grow(tailOldX, tailOldY);
      this.food.reposition(this.snake);

      // Spawn the escape pill when score threshold is crossed
      if (this.score >= 100) {
        this.food.spawnSpecial(this.snake);
      }
    }

    if (this.food.checkSpecialCollision(newX, newY, this.snake.stepSize)) {
      this.audioManager.playEatSound();
      this.triggerEscape();
    }
  }

  /**
   * Physics loop for the escaped gameplay.
   * Checks collisions against dynamic DOM elements on the entire webpage.
   */
  private processEscapePhase(newX: number, newY: number, tailOldX: number, tailOldY: number) {
    const headRect = new Phaser.Geom.Rectangle(
      newX - this.snake.stepSize / 2,
      newY - this.snake.stepSize / 2,
      this.snake.stepSize,
      this.snake.stepSize
    );
    
    const domHits = this.domManager.checkCollisions(headRect);
    if (domHits.length > 0) {
      const oldScore = this.score;
      domHits.forEach(domHit => {
        this.score += 1;
        this.domManager.eatElement(domHit);
      });

      // Directly update the original HTML score counter text inside the DOM.
      // We do this rather than emitting React score-update events because React re-renders 
      // destroy the inline styles and eaten states injected onto DOM nodes.
      const scoreSpan = document.querySelector('#score-display span') as HTMLElement;
      if (scoreSpan) {
        scoreSpan.textContent = this.score.toString();
      }

      // Grow the snake for every 10 points accumulated
      const previousTens = Math.floor(oldScore / 10);
      const currentTens = Math.floor(this.score / 10);
      for(let i=0; i < (currentTens - previousTens); i++){
         this.snake.grow(tailOldX, tailOldY);
      }

      this.audioManager.playEatSound();
    }
  }

  /**
   * Escapes the snake out of the canvas box onto the webpage.
   * - Appends the Phaser canvas element directly to document.body.
   * - Overrides canvas styles to fixed, full-viewport absolute overlays.
   * - Resizes the canvas to match inner window size.
   * - Translates all existing snake coordinates from relative canvas offsets 
   *   to absolute window scroll viewport positions to ensure seamless graphical positioning.
   */
  private triggerEscape() {
    this.isEscaped = true;
    this.food.hide();
    
    this.cameras.main.scrollX = window.scrollX;
    this.cameras.main.scrollY = window.scrollY;

    const canvas = this.game.canvas;
    const rect = canvas.getBoundingClientRect();
    // Offset delta between canvas container coordinates and screen viewport coordinates
    const dx = rect.left + window.scrollX;
    const dy = rect.top + window.scrollY;

    // Shift all graphics coordinates to line up on page viewport positions
    const segments = this.snake.getSegments();
    segments.forEach(seg => {
      this.tweens.killTweensOf(seg);
      seg.x += dx;
      seg.y += dy;
    });

    // @ts-ignore
    this.snake.logicalPositions.forEach(pos => {
      pos.x += dx;
      pos.y += dy;
    });

    document.body.appendChild(canvas);
    
    // Lock canvas overlay styling
    canvas.style.position = 'fixed';
    canvas.style.top = '0px';
    canvas.style.left = '0px';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.zIndex = '9999';
    canvas.style.pointerEvents = 'none';

    this.scale.resize(window.innerWidth, window.innerHeight);
    this.domManager.init();
  }

  /**
   * Final transition sequence triggered when the snake crawls off the page limits.
   * Collapses the entire website by rotating, blurring, shrinking, and sliding 
   * the root container element down, then reloads the webpage.
   */
  private triggerWebBroke() {
    this.isGameOver = true;
    
    // Fade body background to black
    document.body.style.backgroundColor = 'black';
    document.body.style.transition = 'background-color 1s ease';

    const root = document.getElementById('root');
    if (root) {
      root.style.transition = 'all 2.5s cubic-bezier(0.55, 0.085, 0.68, 0.53)';
      root.style.transform = 'rotate(25deg) scale(0) translateY(120vh)';
      root.style.opacity = '0';
      root.style.filter = 'blur(20px)';
    }

    // Fade out game canvas
    const canvas = this.game.canvas;
    canvas.style.transition = 'opacity 1s ease';
    canvas.style.opacity = '0';

    setTimeout(() => {
      window.location.reload();
    }, 3500);
  }
}
