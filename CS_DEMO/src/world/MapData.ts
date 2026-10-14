import * as THREE from 'three';

/** 地图实体定义 */
export interface MapEntity {
  type: 'wall' | 'floor' | 'obstacle' | 'spawn';
  position: [number, number, number];
  size: [number, number, number];
  color?: string;
}

/** 演示地图：一个约 20x20 米的室内场景，带多个房间和障碍物 */
export const DEMO_MAP: MapEntity[] = [
  // ---- 地板 ----
  { type: 'floor', position: [0, -0.1, 0], size: [20, 0.2, 20], color: '#3a3a3a' },

  // ---- 主房间外墙 ----
  { type: 'wall', position: [0, 2, -10], size: [20, 4, 0.4], color: '#5c5c5c' },   // 后墙
  { type: 'wall', position: [0, 2, 10], size: [20, 4, 0.4], color: '#5c5c5c' },    // 前墙
  { type: 'wall', position: [-10, 2, 0], size: [0.4, 4, 20], color: '#6b6b6b' },   // 左墙
  { type: 'wall', position: [10, 2, 0], size: [0.4, 4, 20], color: '#6b6b6b' },    // 右墙
  { type: 'wall', position: [0, 4, 0], size: [20, 0.2, 20], color: '#4a4a4a' },    // 天花板

  // ---- 内部隔墙（形成两个房间） ----
  { type: 'wall', position: [0, 2, 0], size: [0.4, 4, 6], color: '#787878' },       // 中间隔断（留出两侧通道）
  { type: 'wall', position: [-3, 2, 4], size: [6, 4, 0.3], color: '#787878' },     // 前部隔墙

  // ---- 障碍物（箱子、柱子） ----
  { type: 'obstacle', position: [4, 1, -5], size: [1.5, 2, 1.5], color: '#8B7355' },   // 木箱
  { type: 'obstacle', position: [-5, 0.75, -6], size: [1, 1.5, 1], color: '#8B7355' },  // 小箱
  { type: 'obstacle', position: [6, 1.5, 3], size: [0.5, 3, 0.5], color: '#666666' },   // 柱子
  { type: 'obstacle', position: [-7, 0.5, 5], size: [2, 1, 2], color: '#A0522D' },      // 矮平台

  // ---- 生成点 ----
  { type: 'spawn', position: [0, 0, -8], size: [2, 0.05, 2], color: '#00aa00' },
];
