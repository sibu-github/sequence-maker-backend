import { MongoClient, TransactionOptions } from 'mongodb';
import {
  BALANCE_DECIMAL_PRECISION,
  COLL_ACTIVE_PLAYERS,
  COLL_QUESTIONS,
  COLL_QUES_PUBLISH_LOG,
  COLL_WALLETS,
  COLL_WALLET_TRANSACTIONS,
  DB_NAME,
  WALLET_TRANSACTIONE_TYPE_GAME_WIN,
  WALLET_TRANSACTION_STATUS_SUCCESS,
} from './constants';
import { LogLevel, logMessage } from './logger';
import Game from './game';

const SCALE_FACTOR = Math.pow(10, BALANCE_DECIMAL_PRECISION);
const QUESTION_PROJECT_LIST = {
  _id: 0,
};
const TRANSACTION_OPTIONS: TransactionOptions = {
  readPreference: 'primary',
  readConcern: { level: 'local' },
  writeConcern: { w: 'majority' },
};

function roundTwoDecimalPlace(n: number) {
  if (typeof n !== 'number') {
    throw new Error('expected number');
  }
  // @ts-ignore
  const num = Math.round(n + 'e' + BALANCE_DECIMAL_PRECISION);
  return Number(num + 'e' + -BALANCE_DECIMAL_PRECISION);
}

export type CheckAnswerRequest = {
  questionId: number;
  selectedOptionId: number;
  gameToken: string;
};

export type CheckAnswerResponse = {
  invalidToken: boolean;
  isTimeout: boolean;
  insufficientBalance: boolean;
  isCorrect: boolean;
  currentBalance: number;
  balanceDelta: number;
};

class Database {
  client: MongoClient;
  constructor() {
    this.client = null;
  }

  async getClient() {
    if (this.client != null) {
      return this.client;
    }
    if (!process.env.DB_URL) {
      throw new Error('DB_URL not found');
    }
    const mongoClient = new MongoClient(process.env.DB_URL);
    await mongoClient.connect();
    this.client = mongoClient;
    return this.client;
  }

  async getQuestion<T>(excludeList: number[]) {
    const client = await this.getClient();
    const collection = client.db(DB_NAME).collection(COLL_QUESTIONS);
    const pipeline = [
      { $match: { isActive: true, questionId: { $nin: excludeList } } },
      { $sample: { size: 1 } },
      { $project: QUESTION_PROJECT_LIST },
    ];
    const result = await collection.aggregate<T>(pipeline).toArray();
    return result.length > 0 ? result[0] : null;
  }

  async saveToPublishLog(questionId: number, question: string): Promise<void> {
    const client = await this.getClient();
    const collection = client.db(DB_NAME).collection(COLL_QUES_PUBLISH_LOG);
    const questionColl = client.db(DB_NAME).collection(COLL_QUESTIONS);
    const doc = { questionId, question, timestamp: new Date().getTime() };
    await Promise.all([
      collection.insertOne(doc),
      questionColl.updateOne({ questionId }, { $inc: { publishedCount: 1 } }),
    ]);
  }

  async getActivePlayer(gameToken: string) {
    const client = await this.getClient();
    const collection = client.db(DB_NAME).collection(COLL_ACTIVE_PLAYERS);
    const updatedTime = new Date().getTime();
    const result = await collection.findOneAndUpdate(
      { gameToken },
      { $set: { updatedTime } },
      { returnDocument: 'after' }
    );
    return result;
  }

  async checkGameToken(gameToken: string): Promise<boolean> {
    const result = await this.getActivePlayer(gameToken);
    return !!result;
  }

  async checkAnswer(data: CheckAnswerRequest): Promise<CheckAnswerResponse> {
    const response: CheckAnswerResponse = {
      isCorrect: false,
      isTimeout: true,
      insufficientBalance: false,
      invalidToken: false,
      currentBalance: 0,
      balanceDelta: 0,
    };
    try {
      const player = await this.getActivePlayer(data.gameToken);
      if (!player) {
        response.invalidToken = true;
        throw new Error('invalid game token received');
      }
      const game = Game.getInstance();
      const playAmount = player.amount;
      const isCorrect = game.checkAnswer(data.questionId, data.selectedOptionId);
      const balanceDelta = isCorrect ? playAmount : -1 * playAmount;
      try {
        const balanceAfter = await this.updateUserBalance(player.phone, balanceDelta);
        response.isCorrect = isCorrect;
        response.balanceDelta = balanceDelta;
        response.currentBalance = roundTwoDecimalPlace(balanceAfter / SCALE_FACTOR);
        response.isTimeout = false;
      } catch (err) {
        if (err instanceof Error && err.message.startsWith('Insufficient balance')) {
          response.insufficientBalance = true;
          response.isTimeout = false;
        } else {
          throw err;
        }
      }
    } catch (err) {
      logMessage(LogLevel.ERROR, err);
    } finally {
      return response;
    }
  }

  async updateUserBalance(phone: string, balanceDelta: number) {
    if (!phone) {
      throw new Error('phone not present');
    }
    const delta = balanceDelta * SCALE_FACTOR;
    const client = await this.getClient();
    const collWt = client.db(DB_NAME).collection(COLL_WALLET_TRANSACTIONS);
    const collWallet = client.db(DB_NAME).collection(COLL_WALLETS);
    const session = client.startSession();
    let transactionError = null;
    let balanceAfter = 0;
    try {
      const currTs = new Date().getTime();
      await session.withTransaction(async () => {
        const balanceResult = await collWallet.findOne({ phone }, { session });
        const balanceBefore = balanceResult?.balance || 0;
        balanceAfter = balanceBefore + delta;
        if (balanceAfter < 0) {
          throw new Error(`Insufficient balance: ${balanceBefore}, ${delta}`);
        }
        await collWallet.updateOne(
          { phone },
          { $set: { balance: balanceAfter } },
          { upsert: true, session }
        );
        await collWt.insertOne({
          phone,
          amount: balanceDelta,
          balanceBefore,
          balanceAfter,
          transactionType: WALLET_TRANSACTIONE_TYPE_GAME_WIN,
          transactionStatus: WALLET_TRANSACTION_STATUS_SUCCESS,
          createdTime: currTs,
          updatedTime: currTs,
        });
      }, TRANSACTION_OPTIONS);
    } catch (err) {
      transactionError = err;
    } finally {
      await session.endSession();
    }
    if (transactionError) {
      throw transactionError;
    }
    return balanceAfter;
  }
}
const database = new Database();

export default database;
