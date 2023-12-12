import { MongoClient } from 'mongodb';

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
}
const database = new Database();

export default database;
