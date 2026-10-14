import * as THREE from 'three';
import type { InputState } from '../engine/InputManager';
import { PhysicsManager } from '../engine/PhysicsManager';

const WALK_SPEED = 5;
const CROUCH_SPEED = 2.5;
const MOUSE_SENSITIVITY = 0.002;
const PITCH_LIMIT = Math.PI / 2.2;
const EYE_HEIGHT = 1.65;

/** FPS 玩家控制器：视角使用 yaw/pitch，位置使用独立脚底坐标。 */
export class PlayerController {
  public readonly camera: THREE.PerspectiveCamera;
  private readonly position = new THREE.Vector3(4, 0, 7);
  private readonly physics: PhysicsManager;
  private yaw = 0;
  private pitch = 0;

  constructor(physics: PhysicsManager) {
    this.physics = physics;
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      100,
    );
    this.syncCamera();
  }

  update(input: InputState, dt: number): void {
    this.yaw -= input.mouseDelta.x * MOUSE_SENSITIVITY;
    this.pitch -= input.mouseDelta.y * MOUSE_SENSITIVITY;
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch));
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const moveDir = new THREE.Vector3();

    if (input.moveForward !== 0) moveDir.addScaledVector(forward, input.moveForward);
    if (input.moveRight !== 0) moveDir.addScaledVector(right, input.moveRight);
    if (moveDir.lengthSq() > 0) moveDir.normalize();

    const speed = input.crouch ? CROUCH_SPEED : WALK_SPEED;
    this.physics.step(this.position, moveDir, speed, dt);
    if (input.jump) this.physics.jump();

    this.syncCamera();
  }

  private syncCamera(): void {
    this.camera.position.set(
      this.position.x,
      this.position.y + EYE_HEIGHT,
      this.position.z,
    );
  }
}
