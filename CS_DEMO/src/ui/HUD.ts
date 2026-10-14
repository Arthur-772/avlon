/**
 * HUD 管理器：控制屏幕上的 UI 元素（准星、命中标记、提示）。
 * 纯 DOM 操作，不依赖 Three.js。
 */
export class HUD {
  private readonly crosshair: HTMLElement;
  private readonly hitMarker: HTMLElement;
  private readonly lockPrompt: HTMLElement;
  private readonly info: HTMLElement;

  constructor() {
    this.crosshair = document.getElementById('crosshair')!;
    this.hitMarker = document.getElementById('hit-marker')!;
    this.lockPrompt = document.getElementById('lock-prompt')!;
    this.info = document.getElementById('info')!;
  }

  /** 显示/隐藏锁定提示 */
  setLocked(locked: boolean): void {
    this.lockPrompt.style.display = locked ? 'none' : 'block';
    this.crosshair.style.display = locked ? 'block' : 'none';
    this.info.style.display = locked ? 'block' : 'none';
  }

  /** 命中时短暂闪烁红色标记 */
  showHitMarker(): void {
    this.hitMarker.style.opacity = '1';
    setTimeout(() => { this.hitMarker.style.opacity = '0'; }, 150);
  }
}
