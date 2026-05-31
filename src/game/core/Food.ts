import Phaser from 'phaser';
import { GRID_SIZE, CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants';
import { Snake } from './Snake';

/**
 * Food represents the food controller object in Phaser.
 * It manages normal food spawning, custom elastic chomp pill spawning, 
 * collision hitboxes, and coordinates validation rules.
 */
export class Food {
  private scene: Phaser.Scene;
  public sprite!: Phaser.GameObjects.Image;
  public specialSprite: Phaser.GameObjects.Image | null = null;
  public redPillSpawned: boolean = false;
  private readonly TEXTURE_SCALE = 0.2;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Instantiates the primary food sprite.
   */
  public create() {
    this.sprite = this.scene.add.image(0, 0, 'food').setOrigin(0.5);
    this.redPillSpawned = false;
    this.specialSprite = null;
  }

  /**
   * Resets food coordinates to a random valid position and plays a scaling chomp animation.
   */
  public reposition(snake: Snake) {
    const { rx, ry } = this.getRandomValidPosition(snake);
    this.sprite.setPosition(rx, ry);
    this.sprite.setScale(0);
    this.scene.tweens.add({
      targets: this.sprite,
      scale: this.TEXTURE_SCALE,
      duration: 200,
      ease: 'Back.out'
    });
  }

  /**
   * Spawns the special escape pill at a valid random coordinate.
   * Plays a repeating elastic scale yoyo animation to draw player attention.
   */
  public spawnSpecial(snake: Snake) {
    if (this.redPillSpawned) return;
    this.redPillSpawned = true;
    
    const { rx, ry } = this.getRandomValidPosition(snake);
    this.specialSprite = this.scene.add.image(rx, ry, 'special-food').setOrigin(0.5);
    this.specialSprite.setScale(0);
    this.scene.tweens.add({
      targets: this.specialSprite,
      scale: 0.3,
      duration: 500,
      ease: 'Elastic.out',
      yoyo: true,
      repeat: -1,
      hold: 500
    });
  }

  /**
   * Hides the standard food sprite. Used when transitioning to the escape phase.
   */
  public hide() {
    this.sprite.setVisible(false);
    this.sprite.setActive(false);
  }

  /**
   * Collision check for standard food.
   * Checks radial distance against snake head.
   * 
   * @param stepSize Current grid spacing (used to scale hitbox size)
   */
  public checkCollision(x: number, y: number, stepSize: number): boolean {
    if (!this.sprite.active) return false;
    const dist = Phaser.Math.Distance.Between(x, y, this.sprite.x, this.sprite.y);
    // Uses 80% of grid step size for collision hitbox to give the player 
    // a comfortable margin of error when turning close to food.
    return dist < stepSize * 0.8;
  }

  /**
   * Collision check for special escape pill.
   */
  public checkSpecialCollision(x: number, y: number, stepSize: number): boolean {
    if (!this.specialSprite || !this.specialSprite.active) return false;
    const dist = Phaser.Math.Distance.Between(x, y, this.specialSprite.x, this.specialSprite.y);
    if (dist < stepSize * 0.8) {
      this.specialSprite.destroy();
      this.specialSprite = null;
      return true;
    }
    return false;
  }

  /**
   * Resolves a random coordinate pair within canvas limits that doesn't overlap 
   * with any active snake body segments.
   */
  private getRandomValidPosition(snake: Snake): { rx: number, ry: number } {
    let valid = false;
    let rx = 0;
    let ry = 0;
    const margin = GRID_SIZE * 2;
    let attempts = 0;
    
    // Critical safety cap: prevents infinite loop hangs in the main browser thread 
    // if the board becomes fully saturated with snake segments.
    const maxAttempts = 100;

    while (!valid && attempts < maxAttempts) {
      attempts++;
      rx = Phaser.Math.Between(margin, CANVAS_WIDTH - margin);
      ry = Phaser.Math.Between(margin, CANVAS_HEIGHT - margin);

      valid = true;
      for (const segment of snake.getSegments()) {
        const dist = Phaser.Math.Distance.Between(rx, ry, segment.x, segment.y);
        // Exclude coordinates that sit too close to snake segments to avoid spawning food 
        // directly under the snake's tail.
        if (dist < snake.stepSize * 1.5) {
          valid = false;
          break;
        }
      }
    }
    return { rx, ry };
  }
}
