const { io } = require('socket.io-client');

// const SOCKET_URL = 'wss://sequence-maker-backend.onrender.com?token=1111111111_1703043899400_244';
const SOCKET_URL = 'ws://localhost:8080?token=1111111111_1703043899400_244';
const TOPIC = 'GAME_QUESTION';

function createSocketClient() {
  console.log('createSocketClient ');
  const socket = io(SOCKET_URL);

  socket.on('connect', () => {
    console.log('connection successful', socket.id);
  });

  socket.on('disconnect', () => {
    console.log('disconnected');
  });

  socket.on(TOPIC, (data) => {
    console.log('Received: ', socket.id, data);
  });
  socket.on('connect_error', (err) => {
    console.error(err);
  });
}

createSocketClient();
