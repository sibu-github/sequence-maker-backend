const { io } = require('socket.io-client');

// const SOCKET_URL = 'wss://sequence-maker-backend.onrender.com?token=1111111111_1703043899400_244';
const GAME_TOKEN = '1111111111_1703043899400_244';
const SOCKET_URL = `ws://localhost:8080?token=${GAME_TOKEN}`;
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
    const callback = (data) => {
      console.log('received callback: ', data);
    };
    const questionId = data.questionId;
    const selectedOptionId = 1;
    const gameToken = GAME_TOKEN;
    const req = { questionId, selectedOptionId, gameToken };
    setTimeout(() => socket.emit('GAME_ANSWER', req, callback), 3000);
  });
  socket.on('connect_error', (err) => {
    console.error(err);
  });
}

createSocketClient();
