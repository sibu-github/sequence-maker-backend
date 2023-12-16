const { io } = require('socket.io-client');

// const SOCKET_URL = 'wss://sequence-maker-backend.onrender.com';
const SOCKET_URL = 'ws://localhost:8080?token=1234';
const TOPIC = 'GAME_QUESTION';

function createSocketClient() {
  console.log('createSocketClient ');
  const socket = io(SOCKET_URL);
  console.log('after connection ');
  socket.on(TOPIC, (data) => {
    console.log('Received: ', socket.id, data);
  });
  socket.on('connect_error', (err) => {
    console.error(err);
  });
}

createSocketClient();
// setInterval(() => {
// }, 100);
