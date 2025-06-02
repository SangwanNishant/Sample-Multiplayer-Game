const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const statusEl = document.getElementById('status');
const waitingText = document.getElementById('waitingText');
const countdownEl = document.getElementById('countdown');
const readyButton = document.getElementById('readyButton');

// Game state
let gameState = null;
let playerId = null;
let playerPosition = null;
let gameActive = false;

// Input state
const keys = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
  KeyW: false,
  KeyA: false,
  KeyS: false,
  KeyD: false,
  Space: false
};

// Setup canvas
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Socket handlers
socket.on('playerPaired', (data) => {
  playerId = socket.id;
  playerPosition = data.player1.id === playerId ? 'left' : 'right';
  
  statusEl.textContent = `Player ${playerPosition.toUpperCase()} - WASD/Arrows to move, SPACE to flap`;
  readyButton.disabled = false;
  
  // Initial empty state
  gameState = {
    leftPlayer: { x: 100, y: 300, velocity: 0 },
    rightPlayer: { x: 500, y: 300, velocity: 0 }
  };
  
  requestAnimationFrame(gameLoop);
});

// [Keep all other socket.on handlers from previous version]

// Input handling
document.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'Space') {
    socket.emit('flap');
  }
});

document.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

function processInput() {
  if (!gameActive || !playerPosition) return;
  
  const moveSpeed = 5;
  let direction = null;
  
  if (playerPosition === 'left') {
    if (keys.KeyA) direction = 'left';
    if (keys.KeyD) direction = 'right';
  } else {
    if (keys.ArrowLeft) direction = 'left';
    if (keys.ArrowRight) direction = 'right';
  }
  
  if (direction) {
    socket.emit('move', { direction, speed: moveSpeed });
  }
}

// Game loop
function gameLoop() {
  processInput();
  
  // Clear canvas
  ctx.fillStyle = '#87CEEB';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  if (gameState) {
    // Draw players
    ctx.fillStyle = playerPosition === 'left' ? '#FF0000' : '#0000FF';
    const player = playerPosition === 'left' ? gameState.leftPlayer : gameState.rightPlayer;
    ctx.fillRect(player.x, player.y, 40, 30);
    
    // Draw opponent
    ctx.fillStyle = playerPosition === 'left' ? '#0000FF' : '#FF0000';
    const opponent = playerPosition === 'left' ? gameState.rightPlayer : gameState.leftPlayer;
    ctx.fillRect(opponent.x, opponent.y, 40, 30);
  }
  
  requestAnimationFrame(gameLoop);
}
socket.on('gameStart', (state) => {
  gameActive = true;
  gameState = state;
  readyButton.style.display = 'none';
  waitingText.style.display = 'none';
  statusEl.textContent = `Game started! ${playerPosition.toUpperCase()} player - SPACE to flap`;
  
  // Add game update listener
  socket.on('gameUpdate', (state) => {
    gameState = state;
  });
});
// [Keep ready button handler from previous version]