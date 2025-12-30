import { sdk } from 'https://esm.sh/@farcaster/frame-sdk';

// Initialize Farcaster SDK
sdk.actions.ready();

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score-value');
const shotsEl = document.getElementById('shots-value');
const messageEl = document.getElementById('message');
const restartBtn = document.getElementById('restart-btn');

// Game settings
const FRICTION = 0.98;
const BALL_RADIUS = 12;
const POCKET_RADIUS = 18;
const MIN_VELOCITY = 0.15;
const MAX_POWER = 18;
const RESTITUTION = 0.9; // Energy loss on collision

let balls = [];
let cueBall = null;
let pockets = [];
let score = 0;
let shots = 0;
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let dragEnd = { x: 0, y: 0 };
let isMoving = false;
let gameOver = false;

// Ball colors
const BALL_COLORS = [
  '#f5f5f5', // Cue ball (white)
  '#fbbf24', // 1 - yellow
  '#3b82f6', // 2 - blue
  '#ef4444', // 3 - red
  '#8b5cf6', // 4 - purple
  '#f97316', // 5 - orange
  '#22c55e', // 6 - green
  '#7c2d12', // 7 - maroon
  '#1f2937', // 8 - black
];

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * window.devicePixelRatio;
  canvas.height = rect.height * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  initPockets();
}

function initPockets() {
  const w = canvas.getBoundingClientRect().width;
  const h = canvas.getBoundingClientRect().height;
  const offset = 10;
  
  pockets = [
    { x: offset, y: offset },
    { x: w / 2, y: offset },
    { x: w - offset, y: offset },
    { x: offset, y: h - offset },
    { x: w / 2, y: h - offset },
    { x: w - offset, y: h - offset },
  ];
}

function createBall(x, y, color, number) {
  return {
    x, y,
    vx: 0, vy: 0,
    radius: BALL_RADIUS,
    color,
    number,
    pocketed: false
  };
}

function initGame() {
  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  
  balls = [];
  score = 0;
  shots = 0;
  gameOver = false;
  
  // Cue ball
  cueBall = createBall(w / 2, h * 0.75, BALL_COLORS[0], 0);
  balls.push(cueBall);
  
  // Rack position (triangle)
  const startX = w / 2;
  const startY = h * 0.3;
  const spacing = BALL_RADIUS * 2.5;
  
  let ballIndex = 1;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col <= row; col++) {
      if (ballIndex < BALL_COLORS.length) {
        const x = startX + (col - row / 2) * spacing;
        const y = startY + row * spacing * 0.866;
        balls.push(createBall(x, y, BALL_COLORS[ballIndex], ballIndex));
        ballIndex++;
      }
    }
  }
  
  updateUI();
  hideMessage();
}

function updateUI() {
  scoreEl.textContent = score;
  shotsEl.textContent = shots;
}

function showMessage(text) {
  messageEl.textContent = text;
  messageEl.classList.add('show');
}

function hideMessage() {
  messageEl.classList.remove('show');
}

function getCanvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  };
}

function handleStart(e) {
  e.preventDefault();
  if (isMoving || gameOver || !cueBall || cueBall.pocketed) return;
  
  const pos = getCanvasCoords(e);
  const dx = pos.x - cueBall.x;
  const dy = pos.y - cueBall.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  if (dist < BALL_RADIUS * 3) {
    isDragging = true;
    dragStart = { x: cueBall.x, y: cueBall.y };
    dragEnd = pos;
  }
}

function handleMove(e) {
  e.preventDefault();
  if (!isDragging) return;
  dragEnd = getCanvasCoords(e);
}

function handleEnd(e) {
  e.preventDefault();
  if (!isDragging || !cueBall) return;
  
  const dx = dragStart.x - dragEnd.x;
  const dy = dragStart.y - dragEnd.y;
  const power = Math.min(Math.sqrt(dx * dx + dy * dy) * 0.15, MAX_POWER);
  
  if (power > 1) {
    const angle = Math.atan2(dy, dx);
    cueBall.vx = Math.cos(angle) * power;
    cueBall.vy = Math.sin(angle) * power;
    shots++;
    updateUI();
  }
  
  isDragging = false;
}

// Event listeners
canvas.addEventListener('mousedown', handleStart);
canvas.addEventListener('mousemove', handleMove);
canvas.addEventListener('mouseup', handleEnd);
canvas.addEventListener('mouseleave', handleEnd);

canvas.addEventListener('touchstart', handleStart, { passive: false });
canvas.addEventListener('touchmove', handleMove, { passive: false });
canvas.addEventListener('touchend', handleEnd, { passive: false });

restartBtn.addEventListener('click', initGame);

function checkCollision(b1, b2) {
  const dx = b2.x - b1.x;
  const dy = b2.y - b1.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist < b1.radius + b2.radius;
}

function resolveCollision(b1, b2) {
  const dx = b2.x - b1.x;
  const dy = b2.y - b1.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  if (dist === 0) return;
  
  // Separate balls first to prevent overlap
  const overlap = b1.radius + b2.radius - dist;
  if (overlap > 0) {
    const nx = dx / dist;
    const ny = dy / dist;
    const separation = overlap / 2 + 0.5;
    b1.x -= separation * nx;
    b1.y -= separation * ny;
    b2.x += separation * nx;
    b2.y += separation * ny;
  }
  
  // Recalculate after separation
  const dx2 = b2.x - b1.x;
  const dy2 = b2.y - b1.y;
  const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
  
  if (dist2 === 0) return;
  
  // Normal vector
  const nx = dx2 / dist2;
  const ny = dy2 / dist2;
  
  // Relative velocity
  const dvx = b1.vx - b2.vx;
  const dvy = b1.vy - b2.vy;
  
  // Relative velocity in collision normal direction
  const dvn = dvx * nx + dvy * ny;
  
  // Don't resolve if velocities are separating
  if (dvn > 0) return;
  
  // Apply restitution for energy loss
  const impulse = dvn * RESTITUTION;
  
  // Update velocities (equal mass collision)
  b1.vx -= impulse * nx;
  b1.vy -= impulse * ny;
  b2.vx += impulse * nx;
  b2.vy += impulse * ny;
}

function update() {
  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  
  isMoving = false;
  
  // Update ball positions
  for (const ball of balls) {
    if (ball.pocketed) continue;
    
    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.vx *= FRICTION;
    ball.vy *= FRICTION;
    
    // Stop if very slow
    if (Math.abs(ball.vx) < MIN_VELOCITY && Math.abs(ball.vy) < MIN_VELOCITY) {
      ball.vx = 0;
      ball.vy = 0;
    }
    
    if (ball.vx !== 0 || ball.vy !== 0) {
      isMoving = true;
    }
    
    // Wall collisions
    const wallBounce = 0.7;
    if (ball.x - ball.radius < 0) {
      ball.x = ball.radius;
      ball.vx = Math.abs(ball.vx) * wallBounce;
    }
    if (ball.x + ball.radius > w) {
      ball.x = w - ball.radius;
      ball.vx = -Math.abs(ball.vx) * wallBounce;
    }
    if (ball.y - ball.radius < 0) {
      ball.y = ball.radius;
      ball.vy = Math.abs(ball.vy) * wallBounce;
    }
    if (ball.y + ball.radius > h) {
      ball.y = h - ball.radius;
      ball.vy = -Math.abs(ball.vy) * wallBounce;
    }
    
    // Pocket check
    for (const pocket of pockets) {
      const dx = ball.x - pocket.x;
      const dy = ball.y - pocket.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < POCKET_RADIUS) {
        ball.pocketed = true;
        ball.vx = 0;
        ball.vy = 0;
        
        if (ball === cueBall) {
          // Cue ball pocketed - reset it
          setTimeout(() => {
            cueBall.pocketed = false;
            cueBall.x = w / 2;
            cueBall.y = h * 0.75;
          }, 500);
        } else {
          score += 10;
          updateUI();
          checkWin();
        }
        break;
      }
    }
  }
  
  // Ball-to-ball collisions (multiple iterations for stability)
  for (let iter = 0; iter < 3; iter++) {
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        if (balls[i].pocketed || balls[j].pocketed) continue;
        if (checkCollision(balls[i], balls[j])) {
          resolveCollision(balls[i], balls[j]);
        }
      }
    }
  }
}

function checkWin() {
  const remaining = balls.filter(b => b !== cueBall && !b.pocketed).length;
  if (remaining === 0) {
    gameOver = true;
    showMessage(`🎱 You Win!\nScore: ${score}\nShots: ${shots}`);
  }
}

function draw() {
  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  
  // Clear canvas
  ctx.fillStyle = '#1a5f3c';
  ctx.fillRect(0, 0, w, h);
  
  // Draw table lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(20, h * 0.65);
  ctx.lineTo(w - 20, h * 0.65);
  ctx.stroke();
  
  // Draw pockets
  for (const pocket of pockets) {
    ctx.beginPath();
    ctx.arc(pocket.x, pocket.y, POCKET_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = '#0d3320';
    ctx.fill();
    ctx.strokeStyle = '#0a2818';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  
  // Draw balls
  for (const ball of balls) {
    if (ball.pocketed) continue;
    
    // Shadow
    ctx.beginPath();
    ctx.arc(ball.x + 3, ball.y + 3, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fill();
    
    // Ball
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    const gradient = ctx.createRadialGradient(
      ball.x - 4, ball.y - 4, 0,
      ball.x, ball.y, ball.radius
    );
    gradient.addColorStop(0, lightenColor(ball.color, 30));
    gradient.addColorStop(1, ball.color);
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Number on ball (except cue ball)
    if (ball.number > 0 && ball.number < 9) {
      ctx.fillStyle = ball.number === 8 ? '#fff' : '#000';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ball.number, ball.x, ball.y);
    }
  }
  
  // Draw aiming line when dragging
  if (isDragging && cueBall && !cueBall.pocketed) {
    const dx = dragStart.x - dragEnd.x;
    const dy = dragStart.y - dragEnd.y;
    const power = Math.min(Math.sqrt(dx * dx + dy * dy), MAX_POWER / 0.15);
    
    ctx.beginPath();
    ctx.moveTo(cueBall.x, cueBall.y);
    ctx.lineTo(cueBall.x + dx, cueBall.y + dy);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 + power / 200})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Power indicator
    const powerPercent = Math.min(power / (MAX_POWER / 0.15), 1);
    ctx.beginPath();
    ctx.arc(cueBall.x, cueBall.y, BALL_RADIUS + 5 + powerPercent * 15, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(74, 222, 128, ${powerPercent * 0.7})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function lightenColor(color, percent) {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
  const B = Math.min(255, (num & 0x0000FF) + amt);
  return `rgb(${R}, ${G}, ${B})`;
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// Initialize
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
initGame();
gameLoop();

