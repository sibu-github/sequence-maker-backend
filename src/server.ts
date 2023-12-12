import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { DEFAULT_PORT, PUBLISH_INTERVAL, WEB_SOCKET_TOPIC } from './constants';
import QuestionSet from './questions';

const PORT = process.env.PORT || DEFAULT_PORT;

const app = express();
const server = http.createServer(app);
app.get('/ping', (req, res) => {
  res.send('pong!');
});
server.listen(PORT, () => {
  console.log('server is listening on port:', PORT);
});

const socketServer = new Server(server, {
  cors: {
    origin: '*',
  },
});

socketServer.on('connection', (client) => {
  console.log('client connected:', client.id);

  client.on('disconnect', () => {
    console.log('client disconnected:', client.id);
  });
});

async function initializeApp() {
  try {
    const questionSet = new QuestionSet();
    await questionSet.load();
    setInterval(() => {
      let question = questionSet.next();
      console.log('publishing question', question.uid);
      socketServer.emit(WEB_SOCKET_TOPIC, question);
    }, PUBLISH_INTERVAL);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

initializeApp();
