/** 归一化输入状态 */
export interface InputState {
  moveForward: number;   // -1..1
  moveRight: number;     // -1..1
  jump: boolean;
  crouch: boolean;
  fire: boolean;
  mouseDelta: { x: number; y: number };
}

/**
 * 输入管理器：监听键盘和鼠标，输出归一化状态。
 * 使用 PointerLock API 实现 FPS 鼠标控制。
 */
export class InputManager {
  private keys: Set<string> = new Set();
  private mouseAccumulator = { x: 0, y: 0 };
  private locked = false;
  private firePressed = false;
  private onLockChange: ((locked: boolean) => void) | null = null;

  constructor() {
    document.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Space') e.preventDefault();
    });
    document.addEventListener('keyup', (e) => this.keys.delete(e.code));

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseAccumulator.x += e.movementX;
      this.mouseAccumulator.y += e.movementY;
    });

    document.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.firePressed = true;
    });

    // 点击画布锁定鼠标
    document.addEventListener('click', () => this.requestLock());
    // ESC 释放
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement !== null;
      this.onLockChange?.(this.locked);
    });
  }

  requestLock(): void {
    document.body.requestPointerLock();
  }

  onPointerLockChange(cb: (locked: boolean) => void): void {
    this.onLockChange = cb;
  }

  get isLocked(): boolean {
    return this.locked;
  }

  /** 读取当前帧输入并消费一次性事件（鼠标增量、射击） */
  poll(): InputState {
    const state: InputState = {
      moveForward: (this.keys.has('KeyW') ? 1 : 0) + (this.keys.has('KeyS') ? -1 : 0),
      moveRight: (this.keys.has('KeyD') ? 1 : 0) + (this.keys.has('KeyA') ? -1 : 0),
      jump: this.keys.has('Space'),
      crouch: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
      fire: this.firePressed,
      mouseDelta: { x: this.mouseAccumulator.x, y: this.mouseAccumulator.y },
    };

    // 消费一次性事件
    this.mouseAccumulator.x = 0;
    this.mouseAccumulator.y = 0;
    this.firePressed = false;

    return state;
  }
}
