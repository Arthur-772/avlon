import * as THREE from 'three';
import { DEMO_MAP, type MapEntity } from './MapData';
import type { Collider } from '../engine/PhysicsManager';
import type { Renderer } from '../rendering/Renderer';

/**
 * 关卡/场景构建器：
 * - 从 MapData 生成 Three.js 几何体
 * - 为墙壁和障碍物注册碰撞体
 * - 维护可命中物体列表（用于射击检测）
 */
export class Level {
  private readonly renderer: Renderer;
  private colliders: Collider[] = [];
  private meshes: THREE.Mesh[] = [];

  constructor(renderer: Renderer) {
    this.renderer = renderer;
    this.build(DEMO_MAP);
  }

  /** 从地图数据构建场景 */
  private build(entities: MapEntity[]): void {
    const scene = this.renderer.scene;
    this.colliders = [];
    this.meshes = [];

    for (const ent of entities) {
      const geo = new THREE.BoxGeometry(ent.size[0], ent.size[1], ent.size[2]);
      const mat = this.createMaterial(ent);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(ent.position[0], ent.position[1], ent.position[2]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.hittable = ent.type !== 'floor' && ent.type !== 'spawn';

      scene.add(mesh);
      this.meshes.push(mesh);

      // 只为墙和障碍物注册碰撞体
      if (ent.type === 'wall' || ent.type === 'obstacle') {
        const box = new THREE.Box3().setFromObject(mesh);
        this.colliders.push({
          min: box.min.clone(),
          max: box.max.clone(),
        });
      }

      // spawn 点用半透明标记
      if (ent.type === 'spawn') {
        (mesh.material as THREE.Material).dispose();
        mesh.material = new THREE.MeshBasicMaterial({
          color: 0x00ff00,
          transparent: true,
          opacity: 0.3,
        });
        mesh.userData.hittable = false;
      }
    }
  }

  private createMaterial(ent: MapEntity): THREE.Material {
    const color = ent.color ?? '#888888';
    // 障碍物用更粗糙的材质
    if (ent.type === 'obstacle') {
      return new THREE.MeshStandardMaterial({
        color,
        roughness: 0.9,
        metalness: 0.1,
      });
    }
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.7,
      metalness: 0.05,
    });
  }

  /** 获取当前关卡的碰撞体列表 */
  getColliders(): Collider[] {
    return this.colliders;
  }
}
