import { MongoClient } from 'mongodb';
import { COLL_ACTIVE_PLAYERS, COLL_QUESTIONS, COLL_QUES_PUBLISH_LOG, DB_NAME } from './constants';

const QUESTION_PROJECT_LIST = {
  _id: 0,
  questionId: 1,
  solution: 1,
  question: 1,
  options: 1,
  isActive: 1,
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

  async saveToPublishLog(questionId: number, question: string, validTill: number): Promise<void> {
    const client = await this.getClient();
    const collection = client.db(DB_NAME).collection(COLL_QUES_PUBLISH_LOG);
    const doc = {
      questionId,
      question,
      validTill,
      timestamp: new Date().getTime(),
    };
    await collection.insertOne(doc);
  }

  async checkGameToken(gameToken: string): Promise<boolean> {
    const client = await this.getClient();
    const collection = client.db(DB_NAME).collection(COLL_ACTIVE_PLAYERS);
    const result = await collection.findOne({ gameToken });
    return !!result;
  }
}
const database = new Database();

export default database;
