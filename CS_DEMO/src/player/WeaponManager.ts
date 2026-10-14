import * as THREE from 'three';
import type { Renderer } from '../rendering/Renderer';

/** 武器参数 */
const FIRE_RATE = 0.15;        // 秒/发
const MAX_RANGE = 50;

/**
 * 武器管理器：处理射击的射线检测和命中反馈。
 * 从相机位置发射射线，检测与场景中可命中物体的碰撞。
 */
export class WeaponManager {
  private readonly raycaster = new THREE.Raycaster();
  private lastFireTime = 0;
  private hitMarkers: THREE.Mesh[] = [];
  private readonly renderer: Renderer;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
  }

  /**
   * 尝试射击。如果可以射击（冷却已过），执行射线检测。
   * @param origin 射线起点（相机位置）
   * @param direction 射线方向（相机朝向）
   * @param now 当前时间（秒）
   * @returns 命中点，null 表示未命中或冷却中
   */
  fire(origin: THREE.Vector3, direction: THREE.Vector3, now: number): THREE.Vector3 | null {
    if (now - this.lastFireTime < FIRE_RATE) return null;
    this.lastFireTime = now;

    this.raycaster.set(origin, direction.normalize());
    this.raycaster.far = MAX_RANGE;

    // 只检测场景中的可命中物体（排除地板和 spawn）
    const targets: THREE.Object3D[] = this.renderer.scene.children.filter(
      (c): c is THREE.Mesh => c instanceof THREE.Mesh && c.userData.hittable === true,
    );

    const hits = this.raycaster.intersectObjects(targets, false);
    if (hits.length === 0) return null;

    const hit = hits[0];
    this.spawnHitMarker(hit.point, hit.object as THREE.Mesh);
    return hit.point;
  }

  /** 在命中位置生成一个短暂显示的标记球 */
  private spawnHitMarker(point: THREE.Vector3, target: THREE.Mesh): void {
    const geo = new THREE.SphereGeometry(0.08, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff3333, transparent: true, opacity: 0.9 });
    const marker = new THREE.Mesh(geo, mat);
    marker.position.copy(point);

    // 让标记浮在表面外侧
    const normal = point.clone().sub(target.getWorldPosition(new THREE.Vector3())).normalize();
    marker.position.add(normal.multiplyScalar(0.05));

    this.renderer.scene.add(marker);
    this.hitMarkers.push(marker);

    // 300ms 后移除
    setTimeout(() => {
      this.renderer.scene.remove(marker);
      geo.dispose();
      mat.dispose();
      const idx = this.hitMarkers.indexOf(marker);
      if (idx >= 0) this.hitMarkers.splice(idx, 1);
    }, 300);
  }

  /** 清理所有命中标记 */
  dispose(): void {
    for (const m of this.hitMarkers) {
      this.renderer.scene.remove(m);
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    this.hitMarkers = [];
  }
}
