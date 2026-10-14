import * as THREE from 'three';
import { Renderer } from './rendering/Renderer';
import { InputManager } from './engine/InputManager';
import { GameLoop } from './engine/GameLoop';
import { PhysicsManager } from './engine/PhysicsManager';
import { PlayerController } from './player/PlayerController';
import { WeaponManager } from './player/WeaponManager';
import { Level } from './world/Level';
import { HUD } from './ui/HUD';

/**
 * CS_DEMO 游戏入口。
 * 组装所有模块并启动游戏循环。
 */
class Game {
  private readonly renderer: Renderer;
  private readonly input: InputManager;
  private readonly physics: PhysicsManager;
  private readonly player: PlayerController;
  private readonly weapon: WeaponManager;
  private readonly level: Level;
  private readonly hud: HUD;
  private readonly loop: GameLoop;

  private gameTime = 0;

  constructor() {
    // 渲染器
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    this.renderer = new Renderer(canvas);

    // 输入
    this.input = new InputManager();
    this.input.onPointerLockChange((locked) => this.hud.setLocked(locked));
    this.hud = new HUD();
    this.hud.setLocked(false);

    // 物理
    this.physics = new PhysicsManager();

    // 场景
    this.level = new Level(this.renderer);
    this.physics.setColliders(this.level.getColliders());

    // 玩家
    this.player = new PlayerController(this.physics);

    // 武器
    this.weapon = new WeaponManager(this.renderer);

    // 游戏循环
    this.loop = new GameLoop(
      (dt) => this.update(dt),
      () => this.render(),
    );

    // 窗口 resize
    window.addEventListener('resize', () => {
      this.renderer.onResize();
      this.player.camera.aspect = window.innerWidth / window.innerHeight;
      this.player.camera.updateProjectionMatrix();
    });

    this.loop.start();
  }

  private update(dt: number): void {
    this.gameTime += dt;

    const inputState = this.input.poll();

    // 如果未锁定鼠标，跳过游戏逻辑
    if (!this.input.isLocked) return;

    // 玩家更新
    this.player.update(inputState, dt);

    // 武器更新
    if (inputState.fire) {
      const camDir = new THREE.Vector3();
      this.player.camera.getWorldDirection(camDir);
      const hit = this.weapon.fire(
        this.player.camera.position.clone(),
        camDir,
        this.gameTime,
      );
      if (hit) this.hud.showHitMarker();
    }
  }

  private render(): void {
    this.renderer.render(this.player.camera);
  }
}

// 启动
new Game();
