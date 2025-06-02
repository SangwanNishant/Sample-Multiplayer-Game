const express = require('express');
const socketio = require('socket.io');
const http = require('http');
const path = require('path');

const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app);
const io = socketio(server);

// Game state
const waitingPlayers = {};
const gameRooms = {};

io.on('connection', (socket) => {
  console.log('New connection:', socket.id);
  waitingPlayers[socket.id] = socket;
  tryPairPlayers();

  socket.on('disconnect', () => {
    delete waitingPlayers[socket.id];
  });
});

function tryPairPlayers() {
  const waitingIds = Object.keys(waitingPlayers);
  while (waitingIds.length >= 2) {
    createGameRoom(waitingIds.shift(), waitingIds.shift());
  }
}

function createGameRoom(p1, p2) {
  const roomId = `room_${Date.now()}`;
  gameRooms[roomId] = {
    players: {
      [p1]: { position: 'left', ready: false, score: 0 },
      [p2]: { position: 'right', ready: false, score: 0 }
    },
    state: {
      gameActive: false,
      leftPlayer: { x: 100, y: 300, velocity: 0 },
      rightPlayer: { x: 500, y: 300, velocity: 0 },
      bullets: []
    }
  };

  waitingPlayers[p1].join(roomId);
  waitingPlayers[p2].join(roomId);
  delete waitingPlayers[p1];
  delete waitingPlayers[p2];

  initRoomHandlers(roomId, p1, p2);
  io.to(roomId).emit('playerPaired', {
    roomId,
    player1: { id: p1, position: 'left' },
    player2: { id: p2, position: 'right' }
  });
}

function initRoomHandlers(roomId, p1, p2) {
  const room = gameRooms[roomId];
  const p1Socket = io.sockets.sockets.get(p1);
  const p2Socket = io.sockets.sockets.get(p2);

  // Ready system
  const setReady = (id, ready) => {
    room.players[id].ready = ready;
    io.to(roomId).emit('playerReadyUpdate', { playerId: id, ready });
    if (Object.values(room.players).every(p => p.ready)) startGame(roomId);
  };

  p1Socket.on('playerReady', () => setReady(p1, true));
  p2Socket.on('playerReady', () => setReady(p2, true));
  p1Socket.on('playerCancelReady', () => setReady(p1, false));
  p2Socket.on('playerCancelReady', () => setReady(p2, false));

  // Game controls
  p1Socket.on('move', (data) => {
    if (room.state.gameActive) {
      room.state.leftPlayer.x += data.direction === 'left' ? -data.speed : data.speed;
      io.to(roomId).emit('gameUpdate', room.state);
    }
  });

  p2Socket.on('move', (data) => {
    if (room.state.gameActive) {
      room.state.rightPlayer.x += data.direction === 'left' ? -data.speed : data.speed;
      io.to(roomId).emit('gameUpdate', room.state);
    }
  });

  p1Socket.on('flap', () => {
    if (room.state.gameActive) {
      room.state.leftPlayer.velocity = -10;
      io.to(roomId).emit('gameUpdate', room.state);
    }
  });

  p2Socket.on('flap', () => {
    if (room.state.gameActive) {
      room.state.rightPlayer.velocity = -10;
      io.to(roomId).emit('gameUpdate', room.state);
    }
  });

  p1Socket.on('shoot', () => {
    if (room.state.gameActive) {
      room.state.bullets.push({
        x: 150, y: room.state.leftPlayer.y, 
        direction: 'right', owner: p1
      });
      io.to(roomId).emit('gameUpdate', room.state);
    }
  });

  p2Socket.on('shoot', () => {
    if (room.state.gameActive) {
      room.state.bullets.push({
        x: 450, y: room.state.rightPlayer.y, 
        direction: 'left', owner: p2
      });
      io.to(roomId).emit('gameUpdate', room.state);
    }
  });

  // Game loop
  const gameLoop = setInterval(() => {
    if (!room.state.gameActive) return;
    
    // Physics
    room.state.leftPlayer.velocity += 0.5;
    room.state.leftPlayer.y += room.state.leftPlayer.velocity;
    room.state.rightPlayer.velocity += 0.5;
    room.state.rightPlayer.y += room.state.rightPlayer.velocity;

    // Bullets
    room.state.bullets.forEach(bullet => {
      bullet.x += bullet.direction === 'right' ? 10 : -10;
    });

    // Collision detection
    checkCollisions(roomId);
    io.to(roomId).emit('gameUpdate', room.state);
  }, 1000/60);

  function checkCollisions(roomId) {
    // Implement your collision logic here
  }

  function startGame(roomId) {
    room.state.gameActive = true;
    let countdown = 3;
    const timer = setInterval(() => {
      io.to(roomId).emit('countdown', countdown);
      if (countdown-- <= 0) {
        clearInterval(timer);
        io.to(roomId).emit('gameStart', room.state);
      }
    }, 1000);
  }

  // Cleanup
  const cleanup = () => {
    clearInterval(gameLoop);
    delete gameRooms[roomId];
    const remaining = p1Socket.connected ? p2Socket : p1Socket;
    if (remaining?.connected) remaining.emit('opponentDisconnected');
  };

  p1Socket.on('disconnect', cleanup);
  p2Socket.on('disconnect', cleanup);
}

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));