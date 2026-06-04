import Phaser from 'phaser';
import { GRID_SIZE, CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants';

/**
 * Snake represents the core player controller model and animation controller.
 * It manages segment positioning, logical coordinate arrays, input-driven directional shifts, 
 * self-collision checks, tween animations for fluid movement, and wall collision rules.
 */
export class Snake {
  private scene: Phaser.Scene;
  private segments: Phaser.GameObjects.Image[] = [];
  private logicalPositions: Phaser.Math.Vector2[] = [];
  private pendingGrowths: number = 0;
  public direction: Phaser.Math.Vector2 = new Phaser.Math.Vector2(1, 0);
  public nextDirection: Phaser.Math.Vector2 = new Phaser.Math.Vector2(1, 0);
  public stepSize: number = GRID_SIZE;
  private readonly TEXTURE_SCALE = 0.2;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Spawns the initial 3-segment snake at the center of the Phaser canvas coordinate space.
   */
  public create() {
    const offset = GRID_SIZE / 2;
    const startX = Math.floor(CANVAS_WIDTH / 2 / GRID_SIZE) * GRID_SIZE + offset;
    const startY = Math.floor(CANVAS_HEIGHT / 2 / GRID_SIZE) * GRID_SIZE + offset;

    this.segments = [];
    this.logicalPositions = [];

    // Initialize 3-segment logical position vectors (head, body, tail)
    this.logicalPositions.push(new Phaser.Math.Vector2(startX, startY));
    this.logicalPositions.push(new Phaser.Math.Vector2(startX - GRID_SIZE, startY));
    this.logicalPositions.push(new Phaser.Math.Vector2(startX - GRID_SIZE * 2, startY));

    // Instantiate game textures for the corresponding segments
    this.segments.push(this.scene.add.image(startX, startY, 'snake-head').setOrigin(0.5).setScale(this.TEXTURE_SCALE));
    this.segments.push(this.scene.add.image(startX - GRID_SIZE, startY, 'snake-body').setOrigin(0.5).setScale(this.TEXTURE_SCALE));
    this.segments.push(this.scene.add.image(startX - GRID_SIZE * 2, startY, 'snake-body').setOrigin(0.5).setScale(this.TEXTURE_SCALE));
    
    this.direction.set(1, 0);
    this.nextDirection.set(1, 0);
    this.stepSize = GRID_SIZE;
    this.pendingGrowths = 0;
  }

  /**
   * Returns list of segments graphics.
   */
  public getSegments() {
    return this.segments;
  }
  
  /**
   * Returns the head segment graphics.
   */
  public getHead() {
    return this.segments[0];
  }

  /**
   * Returns logical position vectors of all segments.
   */
  public getLogicalPositions() {
    return this.logicalPositions;
  }

  /**
   * Logic routine executed on each game tick to slide the snake forward.
   * Calculates new coordinates, evaluates wall boundaries, checks self-collision, 
   * shifts logical position vectors, runs linear tweens, and rotates the head texture.
   * 
   * @param duration Tick interval duration in ms (used to synchronize tween speeds)
   * @param isEscaped Set to true if the snake has crawled out of the canvas onto the browser viewport
   */
  public move(duration: number, isEscaped: boolean = false): { dead: boolean, hitWall: boolean, newX: number, newY: number, tailOldX: number, tailOldY: number } {
    this.direction.copy(this.nextDirection);
    
    const headPos = this.logicalPositions[0];
    let newX = headPos.x + this.direction.x * this.stepSize;
    let newY = headPos.y + this.direction.y * this.stepSize;

    let tailOldPos = this.logicalPositions[this.logicalPositions.length - 1];
    let tailOldX = tailOldPos.x;
    let tailOldY = tailOldPos.y;

    // Define coordinate boundary limits
    let minX = 0;
    let maxX = CANVAS_WIDTH;
    let minY = 0;
    let maxY = CANVAS_HEIGHT;

    if (isEscaped) {
      // Use document scroll dimensions rather than window viewport boundaries during the escape phase.
      // This is crucial: checking viewport boundaries would kill the snake immediately if the player 
      // scrolled the page (shifting viewport limits relative to coordinates).
      // Checking document bounds lets the player scroll freely to follow the snake, 
      // and boundaries only trigger a collision when the snake leaves the actual page borders.
      minX = 0;
      maxX = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth, window.innerWidth);
      minY = 0;
      maxY = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, window.innerHeight);
    }

    if (newX >= maxX || newX < minX || newY >= maxY || newY < minY) {
      return { dead: true, hitWall: true, newX, newY, tailOldX, tailOldY };
    }

    // Self collision check.
    // Uses a slightly lenient distance threshold (0.4 * stepSize) to account for visual overlap 
    // during direction shift animations, making control feel responsive.
    for (let i = 1; i < this.logicalPositions.length - 1; i++) {
      const pos = this.logicalPositions[i];
      const dist = Phaser.Math.Distance.Between(newX, newY, pos.x, pos.y);
      if (dist < this.stepSize * 0.4) {
        return { dead: true, hitWall: false, newX, newY, tailOldX, tailOldY };
      }
    }

    // Update logical position vector sequence backwards (shift values down the queue)
    for (let i = this.logicalPositions.length - 1; i > 0; i--) {
      this.logicalPositions[i].copy(this.logicalPositions[i - 1]);
    }
    
    // Update head logical coordinates
    this.logicalPositions[0].set(newX, newY);

    // Interpolate sprite graphics to match the updated logical coordinates.
    // Adds a smooth linear tween to make movement appear continuous rather than cell-jumping.
    for (let i = 0; i < this.segments.length; i++) {
      const target = this.logicalPositions[i];
      const sprite = this.segments[i];
      
      const dx = Math.abs(sprite.x - target.x);
      const dy = Math.abs(sprite.y - target.y);

      // If the delta is too large (like during escape coordinate shifts), snap coordinates instantly
      if (dx > this.stepSize * 1.5 || dy > this.stepSize * 1.5) {
        sprite.setPosition(target.x, target.y);
      } else {
        this.scene.tweens.add({
          targets: sprite,
          x: target.x,
          y: target.y,
          duration: duration,
          ease: 'Linear'
        });
      }
    }
    
    // Rotate head texture to face the current heading direction
    const head = this.segments[0];
    if (this.direction.x === 1) head.setAngle(0);
    else if (this.direction.x === -1) head.setAngle(180);
    else if (this.direction.y === 1) head.setAngle(90);
    else if (this.direction.y === -1) head.setAngle(-90);

    // Apply queued growths at the tail position vacated by this tick's movement
    if (this.pendingGrowths > 0) {
      this.grow(tailOldX, tailOldY);
      this.pendingGrowths--;
    }

    return { dead: false, newX, newY, tailOldX, tailOldY };
  }

  /**
   * Appends a new segment to the end of the snake tail.
   */
  public grow(tailOldX: number, tailOldY: number) {
    this.logicalPositions.push(new Phaser.Math.Vector2(tailOldX, tailOldY));
    const newSegment = this.scene.add.image(tailOldX, tailOldY, 'snake-body').setOrigin(0.5);
    newSegment.setScale(this.TEXTURE_SCALE);
    this.segments.push(newSegment);
  }

  /**
   * Queues segment growths to be processed progressively over the next moves.
   */
  public queueGrow(count: number = 1) {
    this.pendingGrowths += count;
  }
}
