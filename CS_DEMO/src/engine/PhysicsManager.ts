import * as THREE from 'three';

/** AABB 碰撞体 */
export interface Collider {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

const GRAVITY = -18;
const JUMP_VELOCITY = 6.5;
const PLAYER_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.3;

/**
 * 玩家物理：重力、AABB 水平碰撞、地面/障碍物顶面与天花板碰撞。
 * position 始终表示玩家脚底位置，渲染层负责叠加眼高。
 */
export class PhysicsManager {
  private velocityY = 0;
  private grounded = false;
  private colliders: Collider[] = [];

  setColliders(list: Collider[]): void {
    this.colliders = list;
  }

  step(position: THREE.Vector3, moveDir: THREE.Vector3, speed: number, dt: number): void {
    this.moveHorizontally(position, moveDir, speed, dt);
    this.moveVertically(position, dt);
  }

  jump(): void {
    if (!this.grounded) return;
    this.velocityY = JUMP_VELOCITY;
    this.grounded = false;
  }

  get isGrounded(): boolean {
    return this.grounded;
  }

  private moveHorizontally(
    position: THREE.Vector3,
    moveDir: THREE.Vector3,
    speed: number,
    dt: number,
  ): void {
    const nextX = position.x + moveDir.x * speed * dt;
    const nextZ = position.z + moveDir.z * speed * dt;

    for (const collider of this.colliders) {
      if (this.isVerticalRangeClear(position, collider)) continue;

      const playerMinX = nextX - PLAYER_RADIUS;
      const playerMaxX = nextX + PLAYER_RADIUS;
      const playerMinZ = nextZ - PLAYER_RADIUS;
      const playerMaxZ = nextZ + PLAYER_RADIUS;

      const overlapsX = playerMaxX > collider.min.x && playerMinX < collider.max.x;
      const overlapsZ = playerMaxZ > collider.min.z && playerMinZ < collider.max.z;
      if (!overlapsX || !overlapsZ) continue;

      const overlapX = Math.min(playerMaxX - collider.min.x, collider.max.x - playerMinX);
      const overlapZ = Math.min(playerMaxZ - collider.min.z, collider.max.z - playerMinZ);

      if (overlapX < overlapZ) {
        position.x = playerMaxX - collider.min.x < collider.max.x - playerMinX
          ? collider.min.x - PLAYER_RADIUS
          : collider.max.x + PLAYER_RADIUS;
      } else {
        position.z = playerMaxZ - collider.min.z < collider.max.z - playerMinZ
          ? collider.min.z - PLAYER_RADIUS
          : collider.max.z + PLAYER_RADIUS;
      }
      return;
    }

    position.x = nextX;
    position.z = nextZ;
  }

  private moveVertically(position: THREE.Vector3, dt: number): void {
    const previousY = position.y;
    this.velocityY += GRAVITY * dt;
    position.y += this.velocityY * dt;
    this.grounded = false;

    if (position.y <= 0 && this.velocityY <= 0) {
      position.y = 0;
      this.velocityY = 0;
      this.grounded = true;
    }

    for (const collider of this.colliders) {
      const overlapsX = position.x + PLAYER_RADIUS > collider.min.x
        && position.x - PLAYER_RADIUS < collider.max.x;
      const overlapsZ = position.z + PLAYER_RADIUS > collider.min.z
        && position.z - PLAYER_RADIUS < collider.max.z;
      if (!overlapsX || !overlapsZ) continue;

      const fallingOntoTop = this.velocityY <= 0
        && previousY >= collider.max.y - 0.01
        && position.y < collider.max.y;
      const risingIntoBottom = this.velocityY > 0
        && previousY + PLAYER_HEIGHT <= collider.min.y + 0.01
        && position.y + PLAYER_HEIGHT > collider.min.y;

      if (fallingOntoTop) {
        position.y = collider.max.y;
        this.velocityY = 0;
        this.grounded = true;
      } else if (risingIntoBottom) {
        position.y = collider.min.y - PLAYER_HEIGHT;
        this.velocityY = 0;
      }
    }
  }

  private isVerticalRangeClear(position: THREE.Vector3, collider: Collider): boolean {
    return position.y >= collider.max.y - 0.01
      || position.y + PLAYER_HEIGHT <= collider.min.y + 0.01;
  }
}
