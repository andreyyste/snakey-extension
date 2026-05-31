import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants';

export class GameUI {
  private scene: Phaser.Scene;
  private scoreText!: Phaser.GameObjects.Text;
  private scoreContainer!: Phaser.GameObjects.Container;
  private gameOverContainer!: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public create() {
    // Score dipindahkan ke React
  }

  public showGameOver() {
    // Prevent overlay stacking if showGameOver is called multiple times
    if (this.gameOverContainer) {
      this.gameOverContainer.destroy();
    }

    const width = this.scene.scale.width;
    const height = this.scene.scale.height;

    // Overlay centered locally in container
    const overlay = this.scene.add.rectangle(0, 0, width, height, 0xffffff, 0.8);
    
    const box = this.scene.add.graphics();
    const boxW = 360; 
    const boxH = 180;
    box.fillStyle(0xffffff, 1);
    box.fillRoundedRect(-boxW/2, -boxH/2, boxW, boxH, 24);
    box.lineStyle(1, 0xe2e8f0, 1);
    box.strokeRoundedRect(-boxW/2, -boxH/2, boxW, boxH, 24);

    const title = this.scene.add.text(0, -20, 'Game Over', {
      fontSize: '32px',
      color: '#0f172a',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontStyle: '800'
    }).setOrigin(0.5);

    const subtitle = this.scene.add.text(0, 30, 'Press SPACE to Restart', {
      fontSize: '16px',
      color: '#64748b',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontStyle: '600'
    }).setOrigin(0.5);

    this.gameOverContainer = this.scene.add.container(width / 2, height / 2, [overlay, box, title, subtitle]);
    this.gameOverContainer.setScrollFactor(0);
    this.gameOverContainer.setDepth(200);

    this.gameOverContainer.setScale(0.9);
    this.gameOverContainer.setAlpha(0);
    this.scene.tweens.add({
      targets: this.gameOverContainer,
      scale: 1,
      alpha: 1,
      duration: 300,
      ease: 'Back.out'
    });
  }
}
