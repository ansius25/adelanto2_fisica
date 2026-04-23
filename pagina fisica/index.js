// ==================== SIMULADOR ====================
  (function() {
    const canvas = document.getElementById('magnetCanvas');
    const ctx = canvas.getContext('2d');
    
    let width = 800, height = 500;
    canvas.width = width;
    canvas.height = height;
    
    // Parámetros del electroimán (dipolo)
    let magnet = {
      x: width / 2,
      y: height / 2,
      angle: 0,
      moment: 1.0
    };
    
    let interactionMode = 'rotate';
    let isDragging = false;
    
    // Parámetros para cálculo de fuerza
    let N = 250;
    let I = 3.5;
    const A = 1e-4;
    const g = 0.01;
    const mu0 = 4 * Math.PI * 1e-7;
    
    function calcularFuerza() {
      return (mu0 * Math.pow(N, 2) * Math.pow(I, 2) * A) / (2 * Math.pow(g, 2));
    }
    
    function updateForceDisplay() {
      const F = calcularFuerza();
      const masaGramos = (F / 9.81) * 1000;
      document.getElementById('forceValue').innerText = F.toFixed(4);
      document.getElementById('massValue').innerText = masaGramos.toFixed(1);
    }
    
    function magneticField(px, py) {
      const dx = px - magnet.x;
      const dy = py - magnet.y;
      const r2 = dx*dx + dy*dy;
      const r = Math.sqrt(r2);
      if (r < 1e-3) return { bx: 0, by: 0 };
      
      const cosTheta = (dx * Math.cos(magnet.angle) + dy * Math.sin(magnet.angle)) / r;
      const factor = magnet.moment / (r2 * r);
      const br = 2 * cosTheta * factor;
      const btheta = Math.sin(cosTheta) * factor;
      
      const thetaField = Math.atan2(dy, dx);
      const bx = br * Math.cos(thetaField) - btheta * Math.sin(thetaField);
      const by = br * Math.sin(thetaField) + btheta * Math.cos(thetaField);
      
      const norm = Math.sqrt(bx*bx + by*by);
      if (norm > 1e-3) {
        return { bx: bx / norm, by: by / norm };
      }
      return { bx: 0, by: 0 };
    }
    
    function drawFieldLines() {
      const startPoints = [];
      for (let ang = 0; ang < Math.PI * 2; ang += Math.PI / 16) {
        const r = 40;
        startPoints.push({
          x: magnet.x + r * Math.cos(ang + magnet.angle),
          y: magnet.y + r * Math.sin(ang + magnet.angle)
        });
      }
      
      for (let i = -3; i <= 3; i++) {
        for (let j = -3; j <= 3; j++) {
          if (i === 0 && j === 0) continue;
          startPoints.push({
            x: magnet.x + i * 60,
            y: magnet.y + j * 60
          });
        }
      }
      
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#2b9eff';
      
      for (const start of startPoints) {
        let x = start.x, y = start.y;
        if (x < 0 || x > width || y < 0 || y > height) continue;
        
        ctx.beginPath();
        ctx.moveTo(x, y);
        
        for (let step = 0; step < 200; step++) {
          const field = magneticField(x, y);
          const stepSize = 5;
          x += field.bx * stepSize;
          y += field.by * stepSize;
          if (x < 0 || x > width || y < 0 || y > height) break;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    
    function drawMagnet() {
      ctx.save();
      ctx.translate(magnet.x, magnet.y);
      ctx.rotate(magnet.angle);
      
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#2b9eff';
      ctx.fillStyle = '#1a3a5c';
      ctx.fillRect(-30, -12, 60, 24);
      ctx.fillStyle = '#2b6e9e';
      ctx.fillRect(-25, -8, 50, 16);
      
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(-35, -8, 8, 16);
      ctx.fillStyle = '#4444ff';
      ctx.fillRect(27, -8, 8, 16);
      
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(-20, -6, 40, 6);
      
      ctx.restore();
      
      ctx.beginPath();
      ctx.arc(magnet.x, magnet.y, 38, 0, Math.PI * 2);
      ctx.strokeStyle = '#2b9eff44';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    
    function draw() {
      ctx.clearRect(0, 0, width, height);
      drawFieldLines();
      drawMagnet();
      
      ctx.font = "12px 'JetBrains Mono', monospace";
      ctx.fillStyle = '#90b4e0';
      ctx.shadowBlur = 0;
      ctx.fillText(`N = ${N} espiras · I = ${I.toFixed(2)} A`, 15, 30);
      ctx.fillText(`F = ${calcularFuerza().toFixed(3)} N · m = ${(calcularFuerza()/9.81*1000).toFixed(0)} g`, 15, 50);
    }
    
    function getMousePos(e) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      let clientX, clientY;
      
      if (e.touches) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      
      let x = (clientX - rect.left) * scaleX;
      let y = (clientY - rect.top) * scaleY;
      x = Math.min(Math.max(0, x), width);
      y = Math.min(Math.max(0, y), height);
      return { x, y };
    }
    
    function onMouseDown(e) {
      e.preventDefault();
      isDragging = true;
      canvas.classList.add('dragging');
      
      const pos = getMousePos(e);
      const dx = pos.x - magnet.x;
      const dy = pos.y - magnet.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      if (dist < 50) {
        if (interactionMode === 'rotate') {
          const angleToMouse = Math.atan2(dy, dx);
          magnet.angle = angleToMouse;
          draw();
        }
      }
    }
    
    function onMouseMove(e) {
      if (!isDragging) return;
      e.preventDefault();
      
      const pos = getMousePos(e);
      
      if (interactionMode === 'rotate') {
        const dx = pos.x - magnet.x;
        const dy = pos.y - magnet.y;
        magnet.angle = Math.atan2(dy, dx);
      } else if (interactionMode === 'move') {
        magnet.x = Math.min(Math.max(pos.x, 40), width - 40);
        magnet.y = Math.min(Math.max(pos.y, 40), height - 40);
      }
      
      draw();
    }
    
    function onMouseUp(e) {
      isDragging = false;
      canvas.classList.remove('dragging');
    }
    
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('touchstart', onMouseDown);
    window.addEventListener('touchmove', onMouseMove);
    window.addEventListener('touchend', onMouseUp);
    
    // Toolbar
    document.querySelectorAll('.tool-btn-pro').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tool-btn-pro').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        interactionMode = btn.dataset.mode;
      });
    });
    
    // Sliders
    const nSlider = document.getElementById('nSpiras');
    const iSlider = document.getElementById('corrienteI');
    const nValue = document.getElementById('nValue');
    const iValue = document.getElementById('iValue');
    
    nSlider.addEventListener('input', (e) => {
      N = parseInt(e.target.value);
      nValue.innerText = N;
      updateForceDisplay();
      draw();
    });
    
    iSlider.addEventListener('input', (e) => {
      I = parseFloat(e.target.value);
      iValue.innerText = I.toFixed(2);
      updateForceDisplay();
      draw();
    });
    
    // Reset
    document.getElementById('resetBtn').addEventListener('click', () => {
      magnet.x = width / 2;
      magnet.y = height / 2;
      magnet.angle = 0;
      draw();
    });
    
    updateForceDisplay();
    draw();
  })();

  // ==================== TABS ====================
  (function() {
    const tabs = document.querySelectorAll('.nav-tabs a');
    const contents = document.querySelectorAll('.tab-content');
    
    function activateTab(tabId) {
      contents.forEach(content => {
        content.classList.remove('active');
        if (content.id === tabId) {
          content.classList.add('active');
        }
      });
      tabs.forEach(tab => {
        tab.classList.remove('active');
        if (tab.getAttribute('data-tab') === tabId) {
          tab.classList.add('active');
        }
      });
    }
    
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const tabId = tab.getAttribute('data-tab');
        activateTab(tabId);
      });
    });
    
    // Activar AUTORES por defecto
    activateTab('autores');
  })();
   // ==================== TABS PRINCIPALES ====================
  const tabs = document.querySelectorAll('.tab-link');
  const contents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', function(e) {
      const tabId = this.getAttribute('data-tab');
      
      // Si es el botón inactivo del laboratorio
      if (this.classList.contains('lab-inactivo')) {
        alert('El laboratorio estará disponible próximamente en un enlace separado.');
        return;
      }
      
      // Activar tab principal
      contents.forEach(content => {
        content.classList.remove('active');
      });
      document.getElementById(tabId).classList.add('active');
      
      tabs.forEach(t => {
        t.classList.remove('active');
      });
      this.classList.add('active');
    });
  });

  // ==================== SUBMENÚ DE ETAPAS DENTRO DE DESARROLLO ====================
  const etapaBtns = document.querySelectorAll('.etapa-btn');
  const etapasContenido = document.querySelectorAll('.etapa-contenido');

  etapaBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const etapaId = this.getAttribute('data-etapa');
      
      // Cambiar estado activo de los botones
      etapaBtns.forEach(b => {
        b.classList.remove('active');
      });
      this.classList.add('active');
      
      // Mostrar el contenido correspondiente
      etapasContenido.forEach(contenido => {
        contenido.classList.remove('active');
      });
      document.getElementById(etapaId).classList.add('active');
    });
  });