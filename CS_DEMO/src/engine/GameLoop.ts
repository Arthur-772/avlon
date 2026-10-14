/** 游戏循环：固定时间步长 requestAnimationFrame 循环 */
export class GameLoop {
  private readonly FIXED_DT = 1 / 60;
  private accumulator = 0;
  private lastTime = 0;
  private rafId = 0;
  private running = false;
  private readonly onUpdate: (dt: number) => void;
  private readonly onRender: () => void;

  constructor(onUpdate: (dt: number) => void, onRender: () => void) {
    this.onUpdate = onUpdate;
    this.onRender = onRender;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.loop(performance.now());
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private loop = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);

    const elapsed = (now - this.lastTime) / 1000;
    this.lastTime = now;
    this.accumulator += Math.min(elapsed, 0.1); // 防止大帧跳跃

    while (this.accumulator >= this.FIXED_DT) {
      this.onUpdate(this.FIXED_DT);
      this.accumulator -= this.FIXED_DT;
    }

    this.onRender();
  };
}
