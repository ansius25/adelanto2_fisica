(function(){
  const canvas = document.getElementById('mainCanvas');
  const ctx = canvas.getContext('2d');
  const slider = document.getElementById('currentSlider');
  const currentSpan = document.getElementById('currentValue');
  const statForce = document.getElementById('statForce');
  const statField = document.getElementById('statField');
  const statCount = document.getElementById('statCount');
  const optGrid = document.getElementById('optGrid');
  const optLines = document.getElementById('optLines');
  const resetBtn = document.getElementById('resetSceneBtn');
  const clearBtn = document.getElementById('clearBtn');
  
  const rotationPanel = document.getElementById('rotationPanel');
  const rotationSlider = document.getElementById('rotationSlider');
  const angleValue = document.getElementById('angleValue');
  const closeRotationBtn = document.getElementById('closeRotationBtn');

  const mu0 = 4 * Math.PI * 1e-7;
  const N_turns = 250;
  let I = 2.8;

  let nails = [], compasses = [], extraMagnets = [], coils = [], permanentMagnets = [];

  // Electroimán principal con ángulo
  const primary = { x: 480, y: 250, w: 90, h: 62, dragging: false, type: 'primary', turns: 250, angle: 0 };
  let selected = null;
  let dragMode = false;
  let dragDX = 0, dragDY = 0;
  let currentTool = 'move';
  let currentRotatingObj = null;

  // CAMPO DIPOLAR CON ORIENTACIÓN (m_x, m_y según ángulo)
  function dipoleFieldAt(x, y, mx, my, strength, angleDeg = 0) {
    let dx = x - mx;
    let dy = y - my;
    let r2 = dx*dx + dy*dy;
    let r = Math.sqrt(r2);
    if (r < 15) r = 15;
    let r3 = r * r * r;
    
    let angleRad = angleDeg * Math.PI / 180;
    let m_magnitude = strength;
    let m_x = Math.sin(angleRad) * m_magnitude;
    let m_y = Math.cos(angleRad) * m_magnitude;
    
    let r_hat_x = dx / r;
    let r_hat_y = dy / r;
    let m_dot_r = m_x * r_hat_x + m_y * r_hat_y;
    let Bx = (3 * m_dot_r * r_hat_x - m_x) / r3;
    let By = (3 * m_dot_r * r_hat_y - m_y) / r3;
    let factor = 3.2e-7;
    return { x: Bx * factor, y: By * factor };
  }

  function fieldAt(x, y) {
    let bx = 0, by = 0;
    
    let electroStrength = mu0 * N_turns * I * 110000;
    let f1 = dipoleFieldAt(x, y, primary.x, primary.y, electroStrength, primary.angle);
    bx += f1.x; by += f1.y;
    
    for(let mag of extraMagnets) {
      let str = mu0 * N_turns * I * (mag.turns/250) * 110000;
      let f = dipoleFieldAt(x, y, mag.x, mag.y, str, mag.angle || 0);
      bx += f.x; by += f.y;
    }
    
    for(let pm of permanentMagnets) {
      let f = dipoleFieldAt(x, y, pm.x, pm.y, 220, pm.angle || 0);
      bx += f.x; by += f.y;
    }
    
    return { x: bx, y: by, mag: Math.hypot(bx, by) };
  }

  function computeFieldMagnitude() { return (mu0 * N_turns * I / 0.05) * 0.25; }
  function computeForce() { return (mu0 * N_turns * N_turns * I * I * 1e-4) / (2 * 0.05 * 0.05); }
  
  function updateStatsUI() {
    currentSpan.innerText = I.toFixed(2) + " A";
    statForce.innerText = computeForce().toExponential(3) + " N";
    statField.innerText = computeFieldMagnitude().toExponential(3) + " T";
    let total = 1 + nails.length + compasses.length + extraMagnets.length + coils.length + permanentMagnets.length;
    statCount.innerText = total;
  }

  // Clases de objetos
  class PermanentMagnet {
    constructor(x,y,w=56,h=24){ 
      this.x=x; this.y=y; this.w=w; this.h=h; 
      this.dragging=false; this.type='magnet'; 
      this.angle=0; 
    }
    contains(mx,my){ return mx>=this.x-this.w/2 && mx<=this.x+this.w/2 && my>=this.y-this.h/2 && my<=this.y+this.h/2; }
    draw(){
      ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(this.angle * Math.PI/180);
      ctx.fillStyle='#7388e6'; ctx.fillRect(-this.w/2, -this.h/2, this.w/2, this.h);
      ctx.fillStyle='#e68392'; ctx.fillRect(0, -this.h/2, this.w/2, this.h);
      ctx.fillStyle='#fff'; ctx.font='bold 10px "Inter"'; 
      ctx.fillText('S', -this.w/4+2, 4); ctx.fillText('N', this.w/4-6, 4);
      ctx.restore();
    }
  }

  class ExtraMagnet {
    constructor(x,y,w=80,h=54,turns=300){ 
      this.x=x; this.y=y; this.w=w; this.h=h; 
      this.turns=turns; this.dragging=false; 
      this.type='extramagnet'; this.angle=0; 
    }
    contains(mx,my){ return mx>=this.x-this.w/2 && mx<=this.x+this.w/2 && my>=this.y-this.h/2 && my<=this.y+this.h/2; }
    draw(){
      ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(this.angle * Math.PI/180);
      ctx.fillStyle='rgba(80,100,130,0.85)'; ctx.fillRect(-this.w/2+8, -this.h/2+4, this.w-16, this.h-8);
      ctx.strokeStyle='#f07a5a'; ctx.lineWidth=1.5;
      for(let i=-this.w/2+12; i<=this.w/2-12; i+=7){ 
        ctx.beginPath(); ctx.moveTo(i, -this.h/2+2); ctx.lineTo(i+5, this.h/2-6); ctx.stroke(); 
      }
      ctx.fillStyle='#121f2f'; ctx.fillRect(-22, this.h/2-12, 44, 12); 
      ctx.strokeStyle='#f7c25c'; ctx.strokeRect(-22, this.h/2-12, 44, 12);
      ctx.fillStyle='#88ffcc'; ctx.font='bold 9px "Inter"'; 
      ctx.fillText('N', -12, -this.h/2+4);
      ctx.fillStyle='#ffaa88'; ctx.fillText('S', -12, this.h/2-4);
      ctx.restore();
    }
  }

  class Nail {
    constructor(x,y){ 
      this.x=x; this.y=y; this.w=10; this.h=34; 
      this.vx=0; this.vy=0; this.dragging=false; 
      this.type='nail'; 
    }
    contains(mx,my){ return mx>=this.x && mx<=this.x+this.w && my>=this.y && my<=this.y+this.h; }
    cx(){ return this.x+this.w/2; } 
    cy(){ return this.y+this.h/2; }
    update(){
      if(this.dragging) return;
      let ax=0, ay=0;
      for(let mag of [primary, ...extraMagnets]){
        let dx = mag.x - this.cx(), dy = mag.y - this.cy();
        let d = Math.max(22, Math.hypot(dx,dy));
        let att = Math.min(2.2, (I * (mag.turns/250) * 2200) / (d*d));
        ax += (dx/d)*att; ay += (dy/d)*att;
      }
      for(let pm of permanentMagnets){
        let dx = pm.x - this.cx(), dy = pm.y - this.cy();
        let d = Math.max(22, Math.hypot(dx,dy));
        ax += (dx/d) * Math.min(1.0, 1200/(d*d));
        ay += (dy/d) * Math.min(1.0, 1200/(d*d));
      }
      let B = fieldAt(this.cx(), this.cy());
      this.vx += (ax + B.x * 35);
      this.vy += (ay + B.y * 35);
      this.vx *= 0.94; this.vy *= 0.94;
      this.x += this.vx; this.y += this.vy;
      this.x = Math.max(0, Math.min(canvas.width - this.w, this.x));
      this.y = Math.max(0, Math.min(canvas.height - this.h, this.y));
    }
    draw(){
      ctx.save(); ctx.translate(this.cx(), this.cy());
      let B = fieldAt(this.cx(), this.cy()); 
      ctx.rotate(Math.atan2(B.y, B.x)+Math.PI/2);
      ctx.fillStyle = '#bdc3d0'; ctx.fillRect(-5, -12, 10, 28);
      ctx.fillStyle = '#5c6e82'; ctx.fillRect(-7, -16, 14, 8);
      ctx.beginPath(); ctx.moveTo(-5,16); ctx.lineTo(5,16); ctx.lineTo(0,24); 
      ctx.fillStyle = '#3e4f62'; ctx.fill();
      ctx.restore();
    }
  }

  class Compass {
    constructor(x,y){ 
      this.x=x; this.y=y; this.r=18; 
      this.angle=0; this.dragging=false; 
      this.type='compass'; 
    }
    contains(mx,my){ return Math.hypot(mx-this.x, my-this.y) <= this.r; }
    update(){ 
      if(!this.dragging) {
        let B = fieldAt(this.x,this.y); 
        let target = Math.atan2(B.y,B.x);
        let diff = target - this.angle; 
        diff = Math.atan2(Math.sin(diff),Math.cos(diff)); 
        this.angle += diff * 0.12;
      }
    }
    draw(){
      ctx.beginPath(); ctx.arc(this.x,this.y,this.r,0,Math.PI*2); 
      ctx.fillStyle='rgba(20,35,55,0.85)'; ctx.fill(); 
      ctx.strokeStyle='#4f9eff'; ctx.stroke();
      ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(this.angle);
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(13,0); 
      ctx.strokeStyle='#ff6655'; ctx.lineWidth=2; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-13,0); 
      ctx.strokeStyle='#2b9eff'; ctx.stroke();
      ctx.beginPath(); ctx.arc(0,0,4,0,Math.PI*2); 
      ctx.fillStyle='#aac9ff'; ctx.fill();
      ctx.restore();
    }
  }

  class Coil {
    constructor(x,y){ 
      this.x=x; this.y=y; this.w=68; this.h=44; 
      this.dragging=false; this.type='coil'; 
      this.angle=0; 
    }
    contains(mx,my){ return mx>=this.x-this.w/2 && mx<=this.x+this.w/2 && my>=this.y-this.h/2 && my<=this.y+this.h/2; }
    draw(){
      ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(this.angle * Math.PI/180);
      ctx.fillStyle='rgba(80,100,130,0.7)'; ctx.fillRect(-this.w/2+8, -this.h/2+4, this.w-16, this.h-8);
      ctx.strokeStyle='#f07a5a';
      for(let i=-this.w/2+12; i<=this.w/2-12; i+=7){ 
        ctx.beginPath(); ctx.moveTo(i, -this.h/2+2); ctx.lineTo(i+5, this.h/2-6); ctx.stroke(); 
      }
      ctx.restore();
    }
  }

  function drawPrimary() {
    ctx.save(); ctx.translate(primary.x, primary.y); ctx.rotate(primary.angle * Math.PI/180);
    ctx.fillStyle='rgba(130,160,200,0.85)'; ctx.fillRect(-primary.w/2, -primary.h/2+6, primary.w-16, primary.h-12);
    ctx.strokeStyle='#ff8c5a'; ctx.lineWidth=1.5;
    for(let i=-38; i<=38; i+=7){ 
      ctx.beginPath(); ctx.moveTo(i, -24); ctx.lineTo(i+5, 24); ctx.stroke(); 
    }
    ctx.fillStyle='#091c2c'; ctx.fillRect(-26, primary.h/2-12, 52, 14); 
    ctx.strokeStyle='#f7b05e'; ctx.strokeRect(-26, primary.h/2-12, 52, 14);
    ctx.fillStyle='#88ffcc'; ctx.font='bold 12px "Inter"'; 
    ctx.fillText('N', -16, -primary.h/2+8);
    ctx.fillStyle='#ffaa88'; ctx.fillText('S', -16, primary.h/2-2);
    ctx.restore();
  }

  function drawFieldLines() {
    if (!optLines.checked) return;
    const stepSize = 2.2;
    const maxSteps = 350;
    let seeds = [];
    const sources = [primary, ...extraMagnets, ...permanentMagnets];
    for (let src of sources) {
      for (let ang = -Math.PI/2.2; ang <= Math.PI/2.2; ang += Math.PI/10) {
        let rad = 34;
        let sx = src.x + Math.cos(ang) * rad;
        let sy = src.y - 24 + Math.sin(ang) * rad * 0.7;
        if (sx > 5 && sx < canvas.width - 5 && sy > 5 && sy < canvas.height - 5) seeds.push({x: sx, y: sy});
      }
    }
    for (let y = 25; y < canvas.height; y += 42) {
      for (let x = 25; x < canvas.width; x += 42) seeds.push({x, y});
    }
    for (let seed of seeds) {
      let pointsForward = [{x: seed.x, y: seed.y}];
      let x = seed.x, y = seed.y;
      for (let step = 0; step < maxSteps; step++) {
        let B = fieldAt(x, y);
        let mag = B.mag;
        if (mag < 1e-10) break;
        let dx = (B.x / mag) * stepSize;
        let dy = (B.y / mag) * stepSize;
        x += dx; y += dy;
        if (x < -50 || x > canvas.width + 50 || y < -50 || y > canvas.height + 50) break;
        pointsForward.push({x, y});
      }
      let pointsBackward = [];
      x = seed.x; y = seed.y;
      for (let step = 0; step < maxSteps; step++) {
        let B = fieldAt(x, y);
        let mag = B.mag;
        if (mag < 1e-10) break;
        let dx = -(B.x / mag) * stepSize;
        let dy = -(B.y / mag) * stepSize;
        x += dx; y += dy;
        if (x < -50 || x > canvas.width + 50 || y < -50 || y > canvas.height + 50) break;
        pointsBackward.unshift({x, y});
      }
      const allPoints = [...pointsBackward, ...pointsForward];
      if (allPoints.length < 8) continue;
      ctx.beginPath();
      ctx.moveTo(allPoints[0].x, allPoints[0].y);
      for (let i = 1; i < allPoints.length; i++) ctx.lineTo(allPoints[i].x, allPoints[i].y);
      ctx.strokeStyle = '#3cdb8b';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }

  function drawCompassGrid() {
    if(!optGrid.checked) return;
    ctx.globalAlpha=0.7;
    for(let y=75; y<=canvas.height-55; y+=72){
      for(let x=110; x<=canvas.width-85; x+=98){
        let B=fieldAt(x,y), ang=Math.atan2(B.y,B.x);
        ctx.save(); ctx.translate(x,y); ctx.rotate(ang);
        ctx.beginPath(); ctx.arc(0,0,11,0,2*Math.PI); 
        ctx.fillStyle='rgba(25,40,60,0.7)'; ctx.fill(); 
        ctx.strokeStyle='#3f9eff'; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(9,0); 
        ctx.strokeStyle='#ff6a55'; ctx.lineWidth=1.8; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-9,0); 
        ctx.strokeStyle='#409eff'; ctx.stroke();
        ctx.restore();
      }
    }
    ctx.globalAlpha=1;
  }

  function showRotationPanel(obj) {
    currentRotatingObj = obj;
    let angle = obj.angle || 0;
    rotationSlider.value = angle;
    angleValue.innerText = angle + "°";
    let rect = canvas.getBoundingClientRect();
    let canvasX = obj.x;
    let canvasY = obj.y - 50;
    let screenX = rect.left + (canvasX / canvas.width) * rect.width;
    let screenY = rect.top + (canvasY / canvas.height) * rect.height;
    rotationPanel.style.display = "flex";
    rotationPanel.style.left = (screenX - 100) + "px";
    rotationPanel.style.top = (screenY - 10) + "px";
  }

  function hideRotationPanel() {
    rotationPanel.style.display = "none";
    currentRotatingObj = null;
  }

  rotationSlider.addEventListener('input', function() {
    if (currentRotatingObj) {
      let newAngle = parseFloat(this.value);
      currentRotatingObj.angle = newAngle;
      angleValue.innerText = newAngle + "°";
    }
  });
  closeRotationBtn.addEventListener('click', hideRotationPanel);

  function setActiveToolUI(tool){ 
    currentTool=tool; 
    document.querySelectorAll('.tool-btn-pro').forEach(btn=>{ 
      if(btn.dataset.tool===tool) btn.classList.add('active'); 
      else btn.classList.remove('active'); 
    }); 
  }
  
  function addNailAt(x,y){ nails.push(new Nail(x-5,y-15)); updateStatsUI(); }
  function addCompassAt(x,y){ compasses.push(new Compass(x,y)); updateStatsUI(); }
  function addPermMagnet(x,y){ permanentMagnets.push(new PermanentMagnet(x,y)); updateStatsUI(); }
  function addExtraMag(x,y){ extraMagnets.push(new ExtraMagnet(x,y,86,56,320)); updateStatsUI(); }
  function addCoilItem(x,y){ coils.push(new Coil(x,y)); updateStatsUI(); }
  
  function resetScene(){ 
    nails=[new Nail(200,370),new Nail(250,390),new Nail(310,365)]; 
    compasses=[new Compass(150,160),new Compass(720,140),new Compass(750,350)]; 
    extraMagnets=[]; coils=[]; 
    permanentMagnets=[new PermanentMagnet(660,240)]; 
    primary.x=480; primary.y=250; primary.angle=0; 
    selected=null; updateStatsUI(); hideRotationPanel(); 
  }
  
  function clearExtras(){ 
    nails=[]; compasses=[]; extraMagnets=[]; coils=[]; permanentMagnets=[]; 
    updateStatsUI(); hideRotationPanel(); 
  }
  
  function getMousePos(e){ 
    let rect=canvas.getBoundingClientRect(); 
    let sx=canvas.width/rect.width, sy=canvas.height/rect.height; 
    return {x:(e.clientX-rect.left)*sx, y:(e.clientY-rect.top)*sy}; 
  }
  
  function findObjectAt(x,y) {
    let all = [...compasses, ...nails, ...permanentMagnets, ...extraMagnets, ...coils];
    for(let obj of all) if(obj.contains(x,y)) return obj;
    if(x>=primary.x-primary.w/2 && x<=primary.x+primary.w/2 && y>=primary.y-primary.h/2 && y<=primary.y+primary.h/2) return primary;
    return null;
  }

  let mouseDownTime = 0;
  let pendingClickObj = null;
  let dragActivated = false;

  function onMouseDown(e) {
    let {x,y} = getMousePos(e);
    canvas.classList.add('dragging');
    mouseDownTime = Date.now();
    
    if(currentTool !== 'move') {
      if(currentTool==='coil') addCoilItem(x,y);
      else if(currentTool==='nail') addNailAt(x,y);
      else if(currentTool==='compass') addCompassAt(x,y);
      else if(currentTool==='magnet') addPermMagnet(x,y);
      else if(currentTool==='electroLarge') addExtraMag(x,y);
      setActiveToolUI('move');
      return;
    }
    
    let obj = findObjectAt(x,y);
    if(obj) {
      pendingClickObj = obj;
      selected = obj;
      dragDX = x - obj.x;
      dragDY = y - obj.y;
    } else {
      selected = null;
      pendingClickObj = null;
      hideRotationPanel();
    }
  }
  
  function onMouseMove(e) {
    if(!selected) return;
    if(!dragActivated && (Date.now() - mouseDownTime) > 150) {
      dragActivated = true;
      dragMode = true;
      selected.dragging = true;
      hideRotationPanel();
    }
    if(dragMode) {
      let {x,y} = getMousePos(e);
      selected.x = x - dragDX;
      selected.y = y - dragDY;
      if(selected.type === 'nail'){ selected.vx = 0; selected.vy = 0; }
      if(currentRotatingObj === selected) hideRotationPanel();
    }
  }
  
  function onMouseUp(e) {
    canvas.classList.remove('dragging');
    let dragDuration = Date.now() - mouseDownTime;
    let wasDrag = dragActivated;
    
    if(selected && !wasDrag && pendingClickObj === selected && currentTool === 'move' && dragDuration < 200) {
      if(selected.type === 'magnet' || selected.type === 'extramagnet' || selected.type === 'coil' || selected.type === 'primary') {
        showRotationPanel(selected);
      }
    }
    
    if(selected) selected.dragging = false;
    selected = null;
    dragMode = false;
    dragActivated = false;
    pendingClickObj = null;
  }
  
  function onMouseLeave() { 
    if(selected) onMouseUp(); 
    dragActivated = false; dragMode = false; selected = null; 
  }
  
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mouseleave', onMouseLeave);
  
  slider.addEventListener('input',(e)=>{ I=parseFloat(e.target.value); updateStatsUI(); });
  resetBtn.addEventListener('click',resetScene); 
  clearBtn.addEventListener('click',clearExtras);
  document.querySelectorAll('.tool-btn-pro').forEach(btn=>btn.addEventListener('click',()=>{ setActiveToolUI(btn.dataset.tool); hideRotationPanel(); }));

  function animate(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    drawFieldLines();
    drawCompassGrid();
    drawPrimary();
    extraMagnets.forEach(m=>m.draw()); 
    coils.forEach(c=>c.draw()); 
    permanentMagnets.forEach(p=>p.draw());
    nails.forEach(n=>{ n.update(); n.draw(); }); 
    compasses.forEach(c=>{ c.update(); c.draw(); });
    requestAnimationFrame(animate);
  }
  
  resetScene(); 
  updateStatsUI(); 
  setActiveToolUI('move'); 
  animate();
})();
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