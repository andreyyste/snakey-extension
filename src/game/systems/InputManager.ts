import Phaser from 'phaser';
import { Snake } from '../core/Snake';
import { AudioManager } from './AudioManager';

export class InputManager {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };
  private audioManager: AudioManager;

  constructor(scene: Phaser.Scene, audioManager: AudioManager) {
    this.audioManager = audioManager;
    if (scene.input.keyboard) {
      this.cursors = scene.input.keyboard.createCursorKeys();
      this.wasd = scene.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D
      }) as any;
    }
  }

  public handleInput(snake: Snake) {
    // Early return if keyboard input is not initialized or supported in the current environment
    if (!this.cursors || !this.wasd) return;

    if ((this.cursors.left.isDown || this.wasd.left.isDown) && snake.direction.x === 0) {
      this.audioManager.init();
      if (snake.nextDirection.x !== -1) {
        snake.nextDirection.set(-1, 0);
        this.audioManager.playTurnSound();
      }
    } else if ((this.cursors.right.isDown || this.wasd.right.isDown) && snake.direction.x === 0) {
      this.audioManager.init();
      if (snake.nextDirection.x !== 1) {
        snake.nextDirection.set(1, 0);
        this.audioManager.playTurnSound();
      }
    } else if ((this.cursors.up.isDown || this.wasd.up.isDown) && snake.direction.y === 0) {
      this.audioManager.init();
      if (snake.nextDirection.y !== -1) {
        snake.nextDirection.set(0, -1);
        this.audioManager.playTurnSound();
      }
    } else if ((this.cursors.down.isDown || this.wasd.down.isDown) && snake.direction.y === 0) {
      this.audioManager.init();
      if (snake.nextDirection.y !== 1) {
        snake.nextDirection.set(0, 1);
        this.audioManager.playTurnSound();
      }
    }
  }
}
