# CS_DEMO — 3D FPS 射击游戏 Demo 实现计划

## 项目概述

在浏览器中复现一个类似 CS 1.5 风格的轻量级第一人称射击体验。核心包括：
- 第一人称视角的移动、跳跃和射击
- 一个具备空间感的简单室内场景（走廊、房间、障碍物）
- 射线命中检测与反馈
- 基础 HUD（准星、命中提示）

目标不是做完整游戏，而是验证 FPS 核心循环的技术可行性，同时保持代码的模块化工程结构，方便后续扩展。

## 技术栈选择

| 层面 | 选型 | 理由 |
|------|------|------|
| 3D 渲染 | Three.js r170+ | WebGL 领域最成熟的库；内置场景图、材质、光照、射线检测；社区资源丰富 |
| 语言 | TypeScript 5.x | 模块间接口清晰，重构安全；Vite 原生支持 TS |
| 构建 | Vite 6.x | 零配置 HMR，开发体验极快；构建产物小 |
| 输入 | PointerLock API + KeyboardEvent | 浏览器原生，无需额外库；PointerLock 是 FPS 标配 |
| 音频 | Web Audio API (可选) | 原生支持，轻量；如有需要可加 Howler.js |
| 物理 | 自研轻量 AABB | 不需要完整物理引擎；Three.js 的 Raycaster 已覆盖射线检测 |

**不引入的依赖**：不引入 Cannon.js/Ammo.js 等物理引擎（demo 规模不需要刚体模拟），不引入 React/Vue 等 UI 框架（HUD 用纯 DOM/CSS 即可）。

## 架构设计

### 模块划分

```
src/
├── engine/               # 引擎层：与具体游戏逻辑无关的基础设施
│   ├── InputManager.ts   # 键盘 + 鼠标输入归一化（WASD/空格/Shift/PointerLock）
│   ├── GameLoop.ts       # requestAnimationFrame 主循环，固定时间步长
│   └── PhysicsManager.ts # 重力 + AABB 碰撞检测 + 地面判断
├── player/               # 玩家层：绑定输入到游戏行为
│   ├── PlayerController.ts # FPS 角色控制（移动、跳跃、蹲伏、视角）
│   └── WeaponManager.ts  # 武器抽象（射击、换弹、后坐力、弹道扩散）
├── world/                # 世界层：关卡数据与场景构建
│   ├── Level.ts          # 场景装配器：从 MapData 生成 Three.js 网格
│   └── MapData.ts       # 地图数据（墙、地板、障碍物的位置与尺寸定义）
├── rendering/            # 渲染层
│   └── Renderer.ts      # Three.js 渲染器 + 后期处理（可选）
├── ui/                   # UI 层：纯 DOM，不依赖 Three.js
│   └── HUD.ts           # 准星十字线 + 命中标记 + 弹药/血量显示
└── main.ts              # 入口：组装各模块并启动游戏
```

### 数据流

```
InputManager → (归一化输入) → PlayerController → (速度向量) → PhysicsManager
                                                       ↓
                                                  (碰撞修正后的位置)
                                                       ↓
                                                  Camera.position 更新
                                                       ↓
                                                  Renderer 重绘

Mouse Click + Camera 朝向 → WeaponManager → Raycaster → (命中检测)
                                                       ↓
                                                  击中目标高亮 + HUD 反馈
```

### 关键接口

```typescript
// InputManager 输出
interface InputState {
  moveForward: number;   // -1..1 (W/S)
  moveRight: number;     // -1..1 (A/D)
  jump: boolean;
  crouch: boolean;
  fire: boolean;
  mouseDelta: { x: number; y: number };
}

// PhysicsManager 碰撞体
interface Collider {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

// 地图数据
interface MapEntity {
  type: 'wall' | 'floor' | 'obstacle' | 'spawn';
  position: [number, number, number];
  size: [number, number, number];
  color?: string;
}
```

## 功能清单与优先级

### P0 — 必须完成（最小可玩）

- [ ] **FPS 视角控制**：PointerLock 鼠标瞄准 + WASD 移动
- [ ] **跳跃**：空格触发，带重力下落和地面检测
- [ ] **射击**：左键从相机发射射线，检测命中，命中点显示标记
- [ ] **简单地图**：至少一个房间（四面墙 + 地板 + 天花板），2-3 个障碍物（箱子/柱子），提供空间感
- [ ] **准星 HUD**：屏幕正中的十字线
- [ ] **碰撞检测**：玩家不能穿墙

### P1 — 提升体验

- [ ] 武器模型（屏幕右下角显示一把简单的枪）
- [ ] 枪口闪光 + 弹壳效果
- [ ] 后坐力（连续射击时准星略微上移）
- [ ] 命中音效（Web Audio API 生成短促击打音）
- [ ] 多个房间 / 走廊连接
- [ ] 简单光照（环境光 + 点光源模拟室内灯光）

### P2 — 锦上添花

- [ ] 敌人 AI（静态靶子 → 移动靶）
- [ ] 血量系统 + 死亡/重生
- [ ] 弹药管理
- [ ] 小地图
- [ ] 贴图 + 更丰富的地图

## 实现阶段

### 阶段 1：项目骨架 (0.5 天)

1. 初始化 Vite + TypeScript 项目
2. 安装 Three.js 依赖
3. 搭建 `main.ts` 入口：创建 Three.js 场景、相机、渲染器
4. 验证：浏览器中看到空白 3D 画布 + PointerLock 可用

### 阶段 2：核心移动 (1 天)

1. 实现 `InputManager`：键盘事件归一化、PointerLock、鼠标增量捕获
2. 实现 `GameLoop`：固定时间步长 rAF 循环
3. 实现 `PlayerController`：
   - 相机朝向由鼠标增量决定（欧拉角 yaw/pitch）
   - 移动方向由 WASD 相对相机朝向计算
   - 跳跃：给 Y 轴速度，受重力影响
4. 实现 `PhysicsManager` 基础版：
   - 重力
   - AABB 与地面碰撞（isGrounded 判断）
5. 验证：能在空地上自由移动和跳跃，视角正常

### 阶段 3：地图与碰撞 (1 天)

1. 定义 `MapData` 格式，设计一个 demo 地图（约 20x20 米的室内场景）
2. 实现 `Level`：用 BoxGeometry + MeshStandardMaterial 生成墙体、地板、障碍物
3. 完善 `PhysicsManager`：
   - 玩家 AABB 与所有墙体/障碍物的碰撞检测
   - 碰撞后修正位置（滑动 along 墙面）
4. 验证：玩家在地图内移动，不能穿墙

### 阶段 4：射击系统 (0.5 天)

1. 实现 `WeaponManager`：
   - 左键触发 `Raycaster` 从相机发射射线
   - 命中检测（遍历场景中所有可命中 mesh）
   - 命中点在命中位置显示一个小球/标记（0.3s 后消失）
2. 实现 `HUD`：
   - CSS 绝对定位的十字准星
   - 命中时短暂闪烁红点
3. 验证：能射击并看到命中反馈

### 阶段 5：打磨与交付 (0.5 天)

1. 武器模型（低模方块拼接）
2. 后坐力 + 弹道扩散
3. 音效（可选）
4. 代码清理 + 注释
5. 最终验证：完整的移动+跳跃+射击循环

## 设计决策与权衡

### 为什么不用完整物理引擎？

Cannon.js/Ammo.js 能提供刚体、碰撞、约束，但：
- Demo 只有 AABB 碰撞检测需求，自研 50 行代码即可
- 引入物理引擎会增加 200KB+ 体积和额外的学习曲线
- 后续如需升级，可以用适配器模式替换 `PhysicsManager` 的实现

### 为什么第一人称相机不挂在 Three.js 的 Object3D 上？

Three.js 的 `PointerLockControls` 是现成的，但它把移动逻辑和相机耦合在一起，不方便加自定义碰撞。自定义 `PlayerController` 直接操作 `Camera.position` + 欧拉角，与 `PhysicsManager` 的交互更清晰。

### 地图数据：硬编码 vs 编辑器 vs 程序化生成

Demo 阶段用 TS 硬编码数组（`MapEntity[]`）。数据结构简单，改几个数字就能调整布局。后续如需可视化编辑，可以导出 JSON + 做简单的 Three.js Editor。

### 渲染管线

默认使用 `WebGLRenderer` + 标准材质。如需更丰富的视觉效果（Bloom、AO），可以在 `Renderer.ts` 中集成 EffectComposer 的后期通道，不影响其他模块。

## 环境要求

- Node.js 18+（需确认本地安装路径）
- 现代浏览器（Chrome/Edge/Firefox，需支持 WebGL 2.0 和 PointerLock）
- 无其他系统依赖

## 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| 浏览器 PointerLock 权限被拒绝 | 无法控制视角 | 添加 ESC 提示 + 点击激活按钮 |
| 移动端触摸不支持 | 仅桌面可用 | 这是预期行为，demo 明确目标桌面端 |
| Three.js 版本 API 变动 | 编译失败 | 锁定 `package.json` 中的版本号 |
| AABB 碰撞在复杂场景下不准确 | 穿墙 | 保持场景几何简单（都是轴对齐盒子），不引入旋转几何体 |

## 文件清单（最终交付物）

```
CS_DEMO/
├── PLAN.md                 ← 本文件
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
└── src/
    ├── main.ts
    ├── engine/
    │   ├── InputManager.ts
    │   ├── GameLoop.ts
    │   └── PhysicsManager.ts
    ├── player/
    │   ├── PlayerController.ts
    │   └── WeaponManager.ts
    ├── world/
    │   ├── Level.ts
    │   └── MapData.ts
    ├── rendering/
    │   └── Renderer.ts
    └── ui/
        └── HUD.ts
```

---

*计划创建日期：2026-08-19*
*下一版本更新：待评估反馈后修订*
