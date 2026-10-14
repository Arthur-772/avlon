/**
 * AEGIS Tactical Solutions — Main Interaction Layer
 */

(function () {
  'use strict';

  // ── Navigation ──
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('.section');

  function setActiveNav(sectionId) {
    navLinks.forEach(link => {
      link.classList.toggle('active', link.dataset.section === sectionId);
    });
  }

  // Intersection Observer for scroll-based nav highlighting
  const observerOptions = { rootMargin: '-50% 0px -50% 0px' };
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        setActiveNav(entry.target.id);
      }
    });
  }, observerOptions);

  sections.forEach(section => observer.observe(section));

  // Click navigation
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      const targetId = link.dataset.section;
      const target = document.getElementById(targetId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActiveNav(targetId);
      }
    });
  });

  // ── Personnel Radar Chart ──
  (function drawPersonnelRadar() {
    const canvas = document.getElementById('personnel-radar');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const parent = canvas.parentElement;
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = Math.min(cx, cy) * 0.55;

    const categories = ['CQB', 'RECON', 'SIGNALS', 'MEDICAL', 'AVIATION', 'HEAVY WEAPONS'];
    const values = [0.88, 0.92, 0.74, 0.81, 0.65, 0.78];
    const numCategories = categories.length;

    // Background grid
    ctx.strokeStyle = 'rgba(30, 36, 44, 0.5)';
    ctx.lineWidth = 0.5;
    for (let level = 1; level <= 5; level++) {
      const r = (radius / 5) * level;
      ctx.beginPath();
      for (let i = 0; i < numCategories; i++) {
        const angle = (Math.PI * 2 * i) / numCategories - Math.PI / 2;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = 'rgba(84, 92, 102, 0.4)';
    for (let i = 0; i < numCategories; i++) {
      const angle = (Math.PI * 2 * i) / numCategories - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
      ctx.stroke();
    }

    // Data polygon
    ctx.fillStyle = 'rgba(45, 138, 78, 0.08)';
    ctx.strokeStyle = 'rgba(45, 138, 78, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < numCategories; i++) {
      const angle = (Math.PI * 2 * i) / numCategories - Math.PI / 2;
      const r = radius * values[i];
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Data points
    for (let i = 0; i < numCategories; i++) {
      const angle = (Math.PI * 2 * i) / numCategories - Math.PI / 2;
      const r = radius * values[i];
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      ctx.fillStyle = '#2d8a4e';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Labels
    ctx.fillStyle = '#8b939e';
    ctx.font = '10px "JetBrains Mono"';
    ctx.textAlign = 'center';
    for (let i = 0; i < numCategories; i++) {
      const angle = (Math.PI * 2 * i) / numCategories - Math.PI / 2;
      const x = cx + Math.cos(angle) * (radius + 16);
      const y = cy + Math.sin(angle) * (radius + 16);
      ctx.fillText(categories[i], x, y + 3);
    }
  })();

  // ── Hex Grid (Force Support) ──
  (function drawHexGrid() {
    const container = document.getElementById('hex-grid');
    if (!container) return;

    const hexSize = 32;
    const cols = 6;
    const rows = 5;
    const width = cols * hexSize * 1.8;
    const height = rows * hexSize * 1.6;

    container.innerHTML = '';

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    container.appendChild(svg);

    const hexW = Math.sqrt(3) * hexSize;
    const hexH = 2 * hexSize;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * hexW * 0.75 + hexW / 2;
        const y = row * hexH * 0.75 + hexH / 2 + (col % 2) * (hexH / 4);

        const points = [];
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 6;
          points.push(`${x + Math.cos(angle) * hexSize},${y + Math.sin(angle) * hexSize}`);
        }

        const polygon = document.createElementNS(svgNS, 'polygon');
        polygon.setAttribute('points', points.join(' '));
        polygon.setAttribute('fill', 'none');
        polygon.setAttribute('stroke', 'rgba(30, 36, 44, 0.6)');
        polygon.setAttribute('stroke-width', '1');

        // Some hexes are active
        if (Math.random() < 0.35) {
          polygon.setAttribute('fill', 'rgba(45, 138, 78, 0.12)');
          polygon.setAttribute('stroke', 'rgba(45, 138, 78, 0.35)');
        }

        svg.appendChild(polygon);
      }
    }
  })();

  // ── Equipment 3D Wireframes ──
  (function drawEquipmentWireframes() {
    document.querySelectorAll('.eq-canvas').forEach(canvas => {
      const parent = canvas.parentElement;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      const id = parseInt(canvas.dataset.id);

      ctx.strokeStyle = 'rgba(58, 110, 165, 0.35)';
      ctx.lineWidth = 1;
      ctx.fillStyle = 'rgba(58, 110, 165, 0.04)';

      const cx = w / 2;
      const cy = h / 2;

      if (id === 1) {
        // UAV — angular stealth shape
        ctx.beginPath();
        ctx.moveTo(cx - 60, cy + 10);
        ctx.lineTo(cx - 20, cy - 30);
        ctx.lineTo(cx + 20, cy - 40);
        ctx.lineTo(cx + 70, cy - 10);
        ctx.lineTo(cx + 80, cy + 15);
        ctx.lineTo(cx + 30, cy + 8);
        ctx.lineTo(cx - 10, cy + 20);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Wings
        ctx.beginPath();
        ctx.moveTo(cx - 10, cy - 5);
        ctx.lineTo(cx - 70, cy - 20);
        ctx.moveTo(cx + 10, cy - 5);
        ctx.lineTo(cx + 70, cy - 20);
        ctx.stroke();

        // Payload indicator
        ctx.strokeStyle = 'rgba(200, 134, 44, 0.4)';
        ctx.beginPath();
        ctx.arc(cx, cy - 5, 18, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(58, 110, 165, 0.35)';

      } else if (id === 2) {
        // Armored vehicle — blocky hull
        ctx.fillRect(cx - 50, cy - 10, 100, 40);
        ctx.strokeRect(cx - 50, cy - 10, 100, 40);

        // Turret
        ctx.fillRect(cx - 12, cy - 28, 24, 18);
        ctx.strokeRect(cx - 12, cy - 28, 24, 18);

        // Barrel
        ctx.beginPath();
        ctx.moveTo(cx + 8, cy - 22);
        ctx.lineTo(cx + 42, cy - 24);
        ctx.stroke();

        // Wheels
        ctx.strokeStyle = 'rgba(84, 92, 102, 0.4)';
        for (let wx = cx - 35; wx <= cx + 35; wx += 18) {
          ctx.beginPath();
          ctx.arc(wx, cy + 18, 10, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(58, 110, 165, 0.35)';

      } else if (id === 3) {
        // Operator kit — modular outline
        // Helmet
        ctx.beginPath();
        ctx.arc(cx, cy - 25, 18, Math.PI, 0);
        ctx.stroke();

        // Vest
        ctx.strokeRect(cx - 20, cy - 10, 40, 35);

        // Pouches
        ctx.fillRect(cx - 14, cy - 4, 8, 12);
        ctx.strokeRect(cx - 14, cy - 4, 8, 12);
        ctx.fillRect(cx + 6, cy - 4, 8, 12);
        ctx.strokeRect(cx + 6, cy - 4, 8, 12);

        // Weapon slung diagonally
        ctx.strokeStyle = 'rgba(200, 134, 44, 0.3)';
        ctx.beginPath();
        ctx.moveTo(cx - 35, cy - 18);
        ctx.lineTo(cx + 30, cy + 15);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(58, 110, 165, 0.35)';

        // Comms arc
        ctx.strokeStyle = 'rgba(45, 138, 78, 0.4)';
        ctx.beginPath();
        ctx.arc(cx, cy - 15, 28, Math.PI * 0.8, Math.PI * 0.2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(58, 110, 165, 0.35)';
      }

      // Grid overlay for all
      ctx.strokeStyle = 'rgba(30, 36, 44, 0.3)';
      ctx.lineWidth = 0.5;
      for (let gx = 0; gx < w; gx += 40) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }
      for (let gy = 0; gy < h; gy += 40) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }
    });
  })();

  // ── Strike Map ──
  (function drawStrikeMap() {
    const canvas = document.getElementById('strike-map');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const parent = canvas.parentElement;
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    const w = canvas.width;
    const h = canvas.height;

    // Grid
    ctx.strokeStyle = 'rgba(30, 36, 44, 0.35)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < w; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Target points
    const targets = [
      { x: 0.18, y: 0.35 },
      { x: 0.42, y: 0.22 },
      { x: 0.65, y: 0.48 },
      { x: 0.72, y: 0.30 },
      { x: 0.38, y: 0.62 },
      { x: 0.55, y: 0.72 },
    ];

    targets.forEach(t => {
      const tx = t.x * w;
      const ty = t.y * h;

      // Crosshair
      ctx.strokeStyle = 'rgba(184, 50, 48, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tx - 10, ty);
      ctx.lineTo(tx + 10, ty);
      ctx.moveTo(tx, ty - 10);
      ctx.lineTo(tx, ty + 10);
      ctx.stroke();

      // Circle
      ctx.beginPath();
      ctx.arc(tx, ty, 6, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(184, 50, 48, 0.4)';
      ctx.stroke();

      // Outer CEP ring
      ctx.beginPath();
      ctx.arc(tx, ty, 14, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(184, 50, 48, 0.15)';
      ctx.setLineDash([3, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // Origin point (lower-left)
    ctx.fillStyle = '#3a6ea5';
    ctx.beginPath();
    ctx.arc(40, h - 40, 5, 0, Math.PI * 2);
    ctx.fill();
  })();

  // ── Escort Radar ──
  (function drawEscortRadar() {
    const canvas = document.getElementById('escort-radar');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const parent = canvas.parentElement;
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(cx, cy) * 0.75;

    // Radar rings
    for (let level = 1; level <= 4; level++) {
      ctx.strokeStyle = 'rgba(30, 36, 44, 0.4)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(cx, cy, (r / 4) * level, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Sweep line — layered arcs for radar wedge effect
    const sweepAngle = (Date.now() / 3000) % (Math.PI * 2);

    ctx.save();
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = `rgba(45, 138, 78, ${0.22 - i * 0.05})`;
      ctx.lineWidth = 1.5 - i * 0.2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r - i * 2, sweepAngle - 0.02, sweepAngle + 0.28);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();

    // Contacts
    const contacts = [
      { dist: 0.25, angle: 0.8 },
      { dist: 0.45, angle: 2.1 },
      { dist: 0.55, angle: 3.8 },
      { dist: 0.68, angle: 5.2 },
      { dist: 0.35, angle: 1.4 },
    ];

    contacts.forEach(c => {
      const px = cx + Math.cos(c.angle) * r * c.dist;
      const py = cy + Math.sin(c.angle) * r * c.dist;
      ctx.fillStyle = '#2d8a4e';
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  })();

  // ── Ops Tile Icons ──
  (function drawOpsIcons() {
    document.querySelectorAll('.ops-tile-icon').forEach(el => {
      const iconName = el.dataset.icon;
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('width', '24');
      svg.setAttribute('height', '24');
      svg.style.color = '#8b939e';

      const paths = {
        crosshair: 'M12 2L12 22M2 12L22 12M18 6L6 18M6 6L18 18',
        users: 'M5 17H3V15C3 13 5 12 7 12M17 17H19V15C19 13 17 12 15 12M12 10C13.66 10 15 8.66 15 7C15 5.34 13.66 4 12 4C10.34 4 9 5.34 9 7C9 8.66 10.34 10 12 10Z',
        globe: 'M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22M12 2C9.24 2 7 6.48 7 12C7 17.52 9.24 22 12 22M12 2C14.76 2 17 6.48 17 12C17 17.52 14.76 22 12 22M2 12H22',
        shield: 'M12 2L3 7V12C3 16.97 7 21.26 12 22C17 21.26 21 16.97 21 12V7L12 2Z',
      };

      const d = paths[iconName] || 'M12 2L12 22M2 12L22 12';
      const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pathEl.setAttribute('d', d);
      pathEl.setAttribute('stroke', 'currentColor');
      pathEl.setAttribute('stroke-width', '1.5');
      pathEl.setAttribute('fill', 'none');
      pathEl.setAttribute('stroke-linecap', 'round');
      pathEl.setAttribute('stroke-linejoin', 'round');

      svg.appendChild(pathEl);
      el.innerHTML = '';
      el.appendChild(svg);
    });
  })();

  // ── Resize handler for canvas visuals ──
  window.addEventListener('resize', () => {
    // Re-draw radar and maps on resize
    // Simply call the functions again (they read container size)
  });
})();
