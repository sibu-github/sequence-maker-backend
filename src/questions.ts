import { COLL_QUESTIONS, DB_NAME } from './constants';
import database from './database';

type GameQuestion = {
  uid: number;
  result: number;
  solution: string;
  question: string;
  options: number[];
  isActive: boolean;
};

class QuestionSet {
  allQuestions: GameQuestion[];
  currIdx: number;
  constructor() {
    this.allQuestions = [];
    this.currIdx = -1;
  }

  next() {
    if (this.allQuestions.length === 0) {
      return;
    }
    const idx = this.currIdx + 1;
    if (idx < this.allQuestions.length) {
      this.currIdx = idx;
      return this.allQuestions[idx];
    } else {
      this.currIdx = 0;
      return this.allQuestions[0];
    }
  }

  async load() {
    console.log('loading all questions');
    const client = await database.getClient();
    const collection = client.db(DB_NAME).collection(COLL_QUESTIONS);
    const totalCount = await collection.countDocuments({});
    let skip = 0;
    while (skip < totalCount) {
      const result = await collection
        .find({})
        .sort({ uid: 1 })
        .skip(skip)
        .limit(1000)
        .project({ _id: 0 })
        .toArray();
      result.forEach((r) => {
        this.allQuestions.push({
          uid: r.uid,
          result: r.result,
          solution: r.solution,
          question: r.question,
          options: r.options,
          isActive: r.isActive,
        });
      });
      skip += 1000;
    }
    console.log('all question loaded', this.allQuestions.length);
  }
}

export default QuestionSet;
