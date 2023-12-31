import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { ANSWER_TOPIC, DEFAULT_PORT, PUBLISH_INTERVAL, WEB_SOCKET_TOPIC } from './constants';
import { LogLevel, logMessage } from './logger';
import Game from './game';
import database, { CheckAnswerRequest, CheckAnswerResponse } from './database';

const PORT = process.env.PORT || DEFAULT_PORT;

// Initialize http server
const app = express();
const server = http.createServer(app);
app.get('/ping', (req, res) => {
  res.send('pong!');
});
server.listen(PORT, () => {
  logMessage(LogLevel.INFO, 'server is listening on port:', PORT);
});

// initialize the web socket server
const socketServer = new Server(server, {
  cors: {
    origin: '*',
  },
});

socketServer.use(async (socket, next) => {
  try {
    if (!socket.handshake.query || !socket.handshake.query.token) {
      throw new Error('game token not found');
    }
    const gameToken = socket.handshake.query.token;
    if (typeof gameToken !== 'string') {
      throw new Error('game token should a string');
    }
    logMessage(LogLevel.INFO, 'Received game token on connection', gameToken);
    const isValid = await database.checkGameToken(gameToken);
    if (!isValid) {
      throw new Error('Invalid game token');
    }
    return next();
  } catch (err) {
    logMessage(LogLevel.ERROR, err.toString());
    next(err);
  }
});

// add event listener on connection and disconnect
socketServer.on('connection', (client) => {
  logMessage(LogLevel.INFO, 'client connected:', client.id);

  client.on('disconnect', () => {
    logMessage(LogLevel.INFO, 'client disconnected:', client.id);
  });

  async function answerHandler(
    data: CheckAnswerRequest,
    callback: (res: CheckAnswerResponse) => void
  ) {
    logMessage(LogLevel.INFO, 'Received answer:', client.id, data);
    try {
      if (typeof data.gameToken !== 'string' || !data.gameToken) {
        throw new Error('gameToken should be string');
      }
      if (typeof data.questionId !== 'number' || !data.questionId) {
        throw new Error('questionId should be number');
      }
      if (typeof data.selectedOptionId !== 'number' || !data.selectedOptionId) {
        throw new Error('selectedOptionId should be number');
      }
      const response = await database.checkAnswer(data);
      logMessage(LogLevel.INFO, 'checkAnser response: ', response);
      if (callback) {
        callback(response);
      }
      if (response.invalidToken || response.insufficientBalance) {
        logMessage(LogLevel.INFO, 'Disconnecting...', response);
        client.disconnect();
      }
    } catch (err) {
      logMessage(LogLevel.ERROR, err);
      if (callback) {
        callback(null);
      }
    }
  }

  client.on(ANSWER_TOPIC, answerHandler);
});

// wait for publish interval cycle
async function waitForCycle() {
  return new Promise((resolve) => setTimeout(resolve, PUBLISH_INTERVAL));
}

async function startGame() {
  try {
    const game = Game.getInstance();
    await game.loadNext();
    while (true) {
      try {
        // publish question
        logMessage(LogLevel.INFO, '------------------------');
        let qs = game.publish();
        if (qs) {
          logMessage(LogLevel.INFO, 'emitting question: ', qs.questionId, qs.question);
          socketServer.emit(WEB_SOCKET_TOPIC, qs);
        }
        await Promise.allSettled([game.loadNext(), waitForCycle()]);
      } catch (err) {
        logMessage(LogLevel.ERROR, 'An error occurred in the game loop.', err);
      }
    }
  } catch (err) {
    logMessage(LogLevel.ERROR, err);
    process.exit(1);
  }
}

startGame();
