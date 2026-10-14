/**
 * AEGIS Tactical Solutions — 3D Tactical Globe
 * Uses Three.js r128 (loaded via CDN in index.html)
 */

(function () {
  const container = document.getElementById('globe-container');
  const canvas = document.getElementById('globe-canvas');
  if (!container || !canvas) return;

  // ── Scene Setup ──
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0.6, 3.2);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // ── Lighting ──
  const ambient = new THREE.AmbientLight(0x1a2430, 0.7);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xc8d6e5, 1.0);
  keyLight.position.set(2, 1, 3);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x3a6ea5, 0.5);
  rimLight.position.set(-1, -0.5, -2);
  scene.add(rimLight);

  // ── Earth Globe ──
  const earthGroup = new THREE.Group();
  scene.add(earthGroup);

  const geometry = new THREE.SphereGeometry(1, 72, 54);

  // Create a procedural dark-tech globe texture via canvas
  const texCanvas = document.createElement('canvas');
  texCanvas.width = 1024;
  texCanvas.height = 512;
  const ctx = texCanvas.getContext('2d');

  // Base: deep charcoal
  ctx.fillStyle = '#11161c';
  ctx.fillRect(0, 0, 1024, 512);

  // Grid lines
  ctx.strokeStyle = 'rgba(30, 40, 54, 0.6)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 48; i++) {
    const y = (i / 48) * 512;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }
  for (let i = 0; i < 72; i++) {
    const x = (i / 72) * 1024;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }

  // Continental silhouettes — rough contours in a techy style
  ctx.fillStyle = 'rgba(26, 34, 44, 0.85)';
  const continents = [
    // North America
    { x: 80, y: 60, w: 260, h: 180, rx: 0.35 },
    { x: 140, y: 120, w: 140, h: 100, rx: 0.25 },
    // South America
    { x: 180, y: 240, w: 90, h: 130, rx: 0.28 },
    // Europe
    { x: 440, y: 70, w: 120, h: 130, rx: 0.30 },
    // Africa
    { x: 430, y: 180, w: 130, h: 220, rx: 0.22 },
    // Asia
    { x: 540, y: 40, w: 280, h: 200, rx: 0.20 },
    // Southeast Asia / Oceania
    { x: 740, y: 200, w: 180, h: 80, rx: 0.30 },
    // Australia
    { x: 750, y: 240, w: 70, h: 50, rx: 0.35 },
  ];

  continents.forEach(c => {
    ctx.beginPath();
    ctx.roundRect(c.x, c.y, c.w, c.h, Math.min(c.w, c.h) * c.rx);
    ctx.fill();
  });

  const texture = new THREE.CanvasTexture(texCanvas);
  texture.wrapS = THREE.RepeatWrapping;

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.75,
    metalness: 0.3,
  });

  const globe = new THREE.Mesh(geometry, material);
  earthGroup.add(globe);

  // ── Tactical Markers (active operation nodes) ──
  const markers = [];
  const markerPositions = [
    { lat: 38.9, lng: -77.0 },   // Washington DC
    { lat: 51.5, lng: -0.1 },    // London
    { lat: 35.7, lng: 139.8 },   // Tokyo
    { lat: 25.2, lng: 55.3 },    // Dubai
    { lat: -33.9, lng: 18.4 },     // Cape Town
    { lat: 1.3, lng: 103.8 },    // Singapore
    { lat: 48.8, lng: 2.3 },     // Paris
    { lat: 55.7, lng: 37.6 },    // Moscow
    { lat: -34.6, lng: -58.4 },  // Buenos Aires
    { lat: 31.2, lng: 121.4 },   // Shanghai
    { lat: 19.0, lng: 72.8 },    // Mumbai
    { lat: 37.5, lng: 127.0 },   // Seoul
  ];

  function latLngToVec3(lat, lng, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);
    return new THREE.Vector3(
      -radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );
  }

  markerPositions.forEach(pos => {
    const vec = latLngToVec3(pos.lat, pos.lng, 1.02);
    const dotGeo = new THREE.SphereGeometry(0.015, 8, 8);
    const dotMat = new THREE.MeshStandardMaterial({
      color: 0x2d8a4e,
      emissive: 0x2d8a4e,
      emissiveIntensity: 0.8,
    });
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.copy(vec);
    earthGroup.add(dot);

    // Pulse ring
    const ringGeo = new THREE.TorusGeometry(0.025, 0.004, 8, 16);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x2d8a4e,
      emissive: 0x2d8a4e,
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.7,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(vec);
    ring.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    earthGroup.add(ring);

    markers.push({ dot, ring, baseScale: 1, phase: Math.random() * Math.PI * 2 });
  });

  // ── Orbital Ring ──
  const orbitGeo = new THREE.TorusGeometry(1.15, 0.003, 16, 120);
  const orbitMat = new THREE.MeshStandardMaterial({
    color: 0x3a6ea5,
    emissive: 0x3a6ea5,
    emissiveIntensity: 0.2,
    transparent: true,
    opacity: 0.5,
  });
  const orbit = new THREE.Mesh(orbitGeo, orbitMat);
  orbit.rotation.x = Math.PI * 0.45;
  orbit.rotation.y = Math.PI * 0.15;
  scene.add(orbit);

  // ── Particle Field ──
  const particlesGeo = new THREE.BufferGeometry();
  const particlesCount = 600;
  const particlesPos = new Float32Array(particlesCount * 3);
  for (let i = 0; i < particlesCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const r = 1.4 + Math.random() * 0.8;
    particlesPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    particlesPos[i * 3 + 1] = r * Math.cos(phi);
    particlesPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  particlesGeo.setAttribute('position', new THREE.BufferAttribute(particlesPos, 3));
  const particlesMat = new THREE.PointsMaterial({
    color: 0x3a6ea5,
    size: 0.008,
    transparent: true,
    opacity: 0.4,
  });
  const particles = new THREE.Points(particlesGeo, particlesMat);
  scene.add(particles);

  // ── Animation Loop ──
  let time = 0;

  function animate() {
    requestAnimationFrame(animate);
    time += 0.004;

    // Slow rotation
    earthGroup.rotation.y += 0.0012;

    // Marker pulses
    markers.forEach(m => {
      const pulse = 1 + Math.sin(time * 3 + m.phase) * 0.3;
      m.dot.scale.setScalar(pulse);
      m.ring.scale.setScalar(1 + Math.sin(time * 2.5 + m.phase) * 0.15);
    });

    // Orbit slow spin
    orbit.rotation.z += 0.0004;

    // Particle field rotation
    particles.rotation.y += 0.0003;
    particles.rotation.x += 0.0001;

    renderer.render(scene, camera);
  }

  animate();

  // ── Resize Handler ──
  window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });
})();
