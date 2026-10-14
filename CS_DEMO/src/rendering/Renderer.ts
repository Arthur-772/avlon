import * as THREE from 'three';

/** Three.js 渲染器封装 */
export class Renderer {
  public readonly renderer: THREE.WebGLRenderer;
  public readonly scene: THREE.Scene;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8fa3bf);
    this.scene.fog = new THREE.Fog(0x8fa3bf, 25, 90);

    // 基础光照
    const ambient = new THREE.AmbientLight(0xdfe8ff, 2.2);
    this.scene.add(ambient);

    const hemisphere = new THREE.HemisphereLight(0xd8e6ff, 0x666666, 1.5);
    this.scene.add(hemisphere);

    const dirLight = new THREE.DirectionalLight(0xffffcc, 2);
    dirLight.position.set(5, 10, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 50;
    dirLight.shadow.camera.left = -20;
    dirLight.shadow.camera.right = 20;
    dirLight.shadow.camera.top = 20;
    dirLight.shadow.camera.bottom = -20;
    this.scene.add(dirLight);
  }

  render(camera: THREE.Camera): void {
    this.renderer.render(this.scene, camera);
  }

  onResize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
