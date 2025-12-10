/* script.js — fixed roll logic, persistent rolls-left, responsive UI */

/* -------- CONFIG -------- */
const DAILY_ROLLS = 3;
const TOKEN_PREFIX = "ZELA-";
const TOKEN_BODY_LEN = 20;
const TOKEN_MIN_DIGITS = 3;
const SECRET_SEQ = "9F0";
const TOKEN_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/* DOM */
const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d', { alpha: true });
const rollBtn = document.getElementById('rollBtn');
const pick1El = document.getElementById('pick1');
const pick2El = document.getElementById('pick2');
const spinsLeftEl = document.getElementById('spinsLeft');
const resultMsg = document.getElementById('resultMsg');
const downloadZela = document.getElementById('downloadZela');
const pointerEl = document.getElementById('pointer');
const tokenListEl = document.getElementById('tokenList');
const soundToggle = document.getElementById('soundToggle');
const resetBtn = document.getElementById('resetBtn');

let width = 600, height = 600;

/* STATE */
let state = { date: null, rolls: DAILY_ROLLS };
let tokens = [];
let rolling = false;

/* STORAGE KEYS */
const STATE_KEY = 'dice_crash_state_v4';
const TOKENS_KEY = 'dice_crash_tokens_v4';

/* ---------- STORAGE ---------- */
function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    const today = new Date().toDateString();
    if (!raw) {
      state = { date: today, rolls: DAILY_ROLLS };
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } else {
      const parsed = JSON.parse(raw);
      if (parsed.date !== today) {
        state = { date: today, rolls: DAILY_ROLLS };
        localStorage.setItem(STATE_KEY, JSON.stringify(state));
      } else {
        state = parsed;
      }
    }
  } catch (e) {
    state = { date: new Date().toDateString(), rolls: DAILY_ROLLS };
  }
  updateSpinsUI();
}
function saveState() { localStorage.setItem(STATE_KEY, JSON.stringify(state)); updateSpinsUI(); }

function loadTokens() {
  try { tokens = JSON.parse(localStorage.getItem(TOKENS_KEY) || '[]'); } catch(e) { tokens = []; }
  renderTokenList();
}
function saveTokens() { localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens)); renderTokenList(); }
function renderTokenList() {
  if (!tokens.length) tokenListEl.textContent = '(none)';
  else tokenListEl.innerHTML = tokens.slice().reverse().map(t => `<div>${t.token} — ${t.prize} — ${new Date(t.issuedAt).toLocaleString()}</div>`).join('');
}

/* ---------- UI helpers ---------- */
function updateSpinsUI() {
  spinsLeftEl.textContent = `Rolls left today: ${state.rolls}`;
  rollBtn.disabled = state.rolls <= 0 || rolling;
}

/* ---------- CANVAS & RESIZE ---------- */
function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  width = Math.round(rect.width);
  height = Math.round(rect.height);
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
window.addEventListener('resize', resizeCanvas);

/* ---------- DIE PHYSICS (2D approximate) ---------- */
class Die {
  constructor(x,y,size,seed=0) {
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.angle = 0; this.av = 0;
    this.size = size; this.mass = 1;
    this.restitution = 0.36; this.friction = 0.02;
    this.seed = seed;
  }
  applyImpulse(ix,iy,ang=0) {
    this.vx += ix/this.mass;
    this.vy += iy/this.mass;
    this.av += ang;
  }
  update(dt) {
    this.vy += 1600 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.angle += this.av * dt;
    const half = this.size / 2;
    if (this.y + half > height - 10) {
      this.y = height - 10 - half;
      if (this.vy > 0) this.vy = -this.vy * this.restitution;
      this.vx *= (1 - this.friction * 5);
      this.av *= (1 - this.friction * 2);
    }
    if (this.y - half < 10) {
      this.y = 10 + half;
      if (this.vy < 0) this.vy = -this.vy * this.restitution;
    }
    if (this.x - half < 10) { this.x = 10 + half; if (this.vx < 0) this.vx = -this.vx * this.restitution; this.av *= 0.98; }
    if (this.x + half > width - 10) { this.x = width - 10 - half; if (this.vx > 0) this.vx = -this.vx * this.restitution; this.av *= 0.98; }
    this.vx *= 1 - Math.min(0.02, dt * 0.8);
    this.vy *= 1 - Math.min(0.02, dt * 0.3);
    this.av *= 1 - Math.min(0.02, dt * 0.6);
  }
  draw(ctx, hueRotation=0) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    const s = this.size; const r = s/2;
    const grad = ctx.createLinearGradient(-r, -r, r, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.04)');
    grad.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = grad;
    ctx.fillRect(-r, -r, s, s);
    const hue = (Date.now() * 0.03 + hueRotation) % 360;
    ctx.lineWidth = Math.max(1, s*0.045);
    ctx.strokeStyle = `hsl(${hue} 90% 60%)`;
    ctx.strokeRect(-r, -r, s, s);
    this.drawPips(ctx, this.getFaceForRender(), s);
    ctx.restore();
  }
  drawPips(ctx, f, s) {
    const gap = s * 0.28; const pip = Math.max(3, Math.round(s*0.07));
    const coords = {
      1: [[0,0]],
      2: [[-gap,-gap],[gap,gap]],
      3: [[-gap,-gap],[0,0],[gap,gap]],
      4: [[-gap,-gap],[gap,-gap],[-gap,gap],[gap,gap]],
      5: [[-gap,-gap],[gap,-gap],[0,0],[-gap,gap],[gap,gap]],
      6: [[-gap,-gap],[gap,-gap],[-gap,0],[gap,0],[-gap,gap],[gap,gap]]
    };
    ctx.fillStyle = '#f3f3f3';
    for (let c of coords[f]) {
      ctx.beginPath();
      ctx.arc(c[0], c[1], pip, 0, Math.PI*2);
      ctx.fill();
      ctx.closePath();
    }
  }
  getFaceForRender() {
    const v = Math.abs(Math.floor((this.angle * 1000) + this.seed)) % 6;
    return (v + 1);
  }
}

/* COLLISIONS */
function collideDice(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const minDist = (a.size + b.size) / 2;
  if (dist < minDist && dist > 0) {
    const nx = dx / dist, ny = dy / dist;
    const overlap = minDist - dist;
    const push = overlap / 2;
    a.x -= nx * push; a.y -= ny * push;
    b.x += nx * push; b.y += ny * push;
    const relvx = b.vx - a.vx, relvy = b.vy - a.vy;
    const relAlong = relvx * nx + relvy * ny;
    if (relAlong < 0) return;
    const e = Math.min(a.restitution, b.restitution);
    const j = (-(1 + e) * relAlong) / (1 / a.mass + 1 / b.mass);
    const ix = j * nx, iy = j * ny;
    a.vx -= ix / a.mass; a.vy -= iy / a.mass;
    b.vx += ix / b.mass; b.vy += iy / b.mass;
    a.av *= 0.98; b.av *= 0.98;
  }
}

/* SCENE SETUP */
let die1, die2;
function resetDicePositions() {
  const s = Math.min(width, height) * 0.14;
  die1 = new Die(width * 0.35, height * 0.22, s, Date.now() % 1000);
  die2 = new Die(width * 0.65, height * 0.22, s, (Date.now() + 999) % 1000);
  die1.angle = Math.random() * Math.PI * 2; die2.angle = Math.random() * Math.PI * 2;
}

/* ROLL LOGIC */
let settleTimer = 0;
function startRoll() {
  if (rolling) return;
  if (state.rolls <= 0) {
    resultMsg.textContent = 'No rolls left today — come back tomorrow!';
    updateSpinsUI();
    return;
  }
  state.rolls = Math.max(0, state.rolls - 1);
  saveState();
  updateSpinsUI();

  const power = 700;
  die1.applyImpulse((Math.random()*2 -1) * power, (Math.random()*-1.2 -0.6) * power, (Math.random()*12 - 6));
  die2.applyImpulse((Math.random()*2 -1) * power, (Math.random()*-1.2 -0.6) * power, (Math.random()*12 - 6));
  die1.x -= 10; die2.x += 10;

  rolling = true; settleTimer = 0;
  resultMsg.textContent = 'Rolling...';
  pointerEl.classList.remove('win-glow');
  if (soundEnabled()) clickAudio();
}

/* SETTLE DETECTION */
function checkSettled(dt) {
  const velThresh = 20; const angThresh = 0.6;
  const aSlowed = Math.hypot(die1.vx, die1.vy) < velThresh && Math.abs(die1.av) < angThresh;
  const bSlowed = Math.hypot(die2.vx, die2.vy) < velThresh && Math.abs(die2.av) < angThresh;
  if (aSlowed && bSlowed) {
    settleTimer += dt;
    if (settleTimer > 0.85) return true;
  } else settleTimer = 0;
  return false;
}

/* FINALIZE */
function finalizeRoll() {
  rolling = false;
  const f1 = die1.getFaceForRender(); const f2 = die2.getFaceForRender();
  const pick1 = parseInt(pick1El.value) || 0; const pick2 = parseInt(pick2El.value) || 0;
  if (f1 === pick1 && f2 === pick2) {
    resultMsg.textContent = `You rolled ${f1} & ${f2} — YOU WIN!`;
    if (soundEnabled()) winAudio();
    confetti({ particleCount: 200, spread: 140, origin: { y: 0.6 } });
    const token = generateValidToken(); tokens.push({ token, prize: 'GRAND', issuedAt: Date.now() });
    saveTokens(); createZelaDownload(token);
    pointerEl.classList.add('pointer-wiggle'); pointerEl.classList.add('win-glow');
    setTimeout(()=>pointerEl.classList.remove('pointer-wiggle'), 700);
  } else {
    resultMsg.textContent = `You rolled ${f1} & ${f2} — Try again.`;
    if (soundEnabled()) failAudio();
  }
}

/* TOKEN generation (unchanged) */
function generateValidToken() {
  let attempt = 0;
  while (attempt++ < 1200) {
    let body = '';
    for (let i=0;i<TOKEN_BODY_LEN;i++) body += TOKEN_CHARSET.charAt(Math.floor(Math.random()*TOKEN_CHARSET.length));
    if (!body.includes(SECRET_SEQ)) {
      const pos = Math.floor(Math.random() * (TOKEN_BODY_LEN - SECRET_SEQ.length + 1));
      body = body.slice(0,pos) + SECRET_SEQ + body.slice(pos + SECRET_SEQ.length);
      if (body.length > TOKEN_BODY_LEN) body = body.slice(0, TOKEN_BODY_LEN);
    }
    let digits = (body.match(/[0-9]/g) || []).length;
    let tries = 0;
    while (digits < TOKEN_MIN_DIGITS && tries++ < TOKEN_BODY_LEN) {
      const pos = Math.floor(Math.random()*TOKEN_BODY_LEN);
      const d = String(Math.floor(Math.random()*10));
      if (!/[0-9]/.test(body[pos])) {
        body = body.slice(0,pos) + d + body.slice(pos+1);
        digits++;
      }
    }
    const tok = (TOKEN_PREFIX + body).toUpperCase();
    if (validateTokenFormat(tok).valid) return tok;
  }
  return TOKEN_PREFIX + '9F0' + Array(TOKEN_BODY_LEN-3).fill('0').join('');
}
function validateTokenFormat(token) {
  if (typeof token !== 'string') return { valid:false };
  if (!token.startsWith(TOKEN_PREFIX)) return { valid:false };
  const body = token.slice(TOKEN_PREFIX.length);
  if (body.length !== TOKEN_BODY_LEN) return { valid:false };
  if (!/^[A-Z0-9]+$/.test(body)) return { valid:false };
  if ((body.match(/[0-9]/g) || []).length < TOKEN_MIN_DIGITS) return { valid:false };
  if (!body.includes(SECRET_SEQ)) return { valid:false };
  return { valid:true };
}
function createZelaDownload(token) {
  const payload = `TOKEN:${token}\nISSUED:${new Date().toISOString()}\nNOTE: Redeem locally on verify page\n`;
  const blob = new Blob([payload], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  downloadZela.href = url; downloadZela.download = `${token}.zela`; downloadZela.style.display = 'inline-block';
}

/* AUDIO */
let audioCtx = null;
function ensureAudio() { if (!audioCtx) try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) { audioCtx = null; } }
function soundEnabled(){ return soundToggle && soundToggle.checked; }
function clickAudio(){ ensureAudio(); if (!audioCtx) return; const o=audioCtx.createOscillator(), g=audioCtx.createGain(); o.type='square'; o.frequency.value=880; g.gain.value=0; o.connect(g); g.connect(audioCtx.destination); const now=audioCtx.currentTime; g.gain.setValueAtTime(0.0001,now); g.gain.exponentialRampToValueAtTime(0.05, now+0.01); g.gain.exponentialRampToValueAtTime(0.0001, now+0.08); o.start(now); o.stop(now+0.12); }
function rollWhoosh(){ ensureAudio(); if(!audioCtx) return; const o=audioCtx.createOscillator(), g=audioCtx.createGain(); o.type='sawtooth'; const now=audioCtx.currentTime; o.frequency.setValueAtTime(160, now); o.frequency.exponentialRampToValueAtTime(1200, now+1.0); g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.06, now+0.05); g.gain.exponentialRampToValueAtTime(0.0001, now+1.0); o.connect(g); g.connect(audioCtx.destination); o.start(now); o.stop(now+1.05); }
function winAudio(){ ensureAudio(); if(!audioCtx) return; const notes=[880,990,1320]; const now=audioCtx.currentTime; notes.forEach((n,i)=>{ const o=audioCtx.createOscillator(), g=audioCtx.createGain(); o.type='sine'; o.frequency.setValueAtTime(n, now+i*0.08); g.gain.setValueAtTime(0.0001, now+i*0.08); g.gain.exponentialRampToValueAtTime(0.12, now+i*0.08+0.01); g.gain.exponentialRampToValueAtTime(0.0001, now+i*0.08+0.32); o.connect(g); g.connect(audioCtx.destination); o.start(now+i*0.08); o.stop(now+i*0.08+0.32); }); }
function failAudio(){ ensureAudio(); if(!audioCtx) return; const o=audioCtx.createOscillator(), g=audioCtx.createGain(); o.type='square'; o.frequency.value=140; const now=audioCtx.currentTime; g.gain.setValueAtTime(0.0001,now); g.gain.exponentialRampToValueAtTime(0.05, now+0.01); g.gain.exponentialRampToValueAtTime(0.0001, now+0.12); o.connect(g); g.connect(audioCtx.destination); o.start(now); o.stop(now+0.15); }

/* ANIMATION LOOP */
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  die1.update(dt);
  die2.update(dt);
  collideDice(die1, die2);

  ctx.clearRect(0,0,width,height);
  ctx.fillStyle = 'rgba(255,255,255,0.02)';
  ctx.fillRect(0, height-10, width, 10);

  const hueRotation = (Date.now() * 0.03) % 360;
  die1.draw(ctx, hueRotation);
  die2.draw(ctx, hueRotation + 80);

  if (rolling) {
    if (checkSettled(dt)) finalizeRoll();
    else if (Math.random() < 0.003 && soundEnabled()) rollWhoosh();
  }

  requestAnimationFrame(loop);
}

/* UI wiring */
rollBtn.addEventListener('click', async () => {
  ensureAudio();
  if (audioCtx && audioCtx.state === 'suspended') try { await audioCtx.resume(); } catch(e){}
  startRoll();
});

resetBtn.addEventListener('click', ()=>{
  if (!confirm('Reset rolls and token registry?')) return;
  localStorage.removeItem(STATE_KEY);
  localStorage.removeItem(TOKENS_KEY);
  loadState(); loadTokens();
  downloadZela.style.display = 'none';
  resultMsg.textContent = 'Reset complete.';
});

soundToggle.addEventListener('change', ()=> { /* no op: state read when playing */ });

/* STARTUP */
function init() {
  resizeCanvas();
  resetDicePositions();
  loadState();
  loadTokens();
  last = performance.now();
  requestAnimationFrame(loop);
}
init();
