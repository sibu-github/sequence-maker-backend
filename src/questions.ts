import { COLL_QUESTIONS, COLL_QUES_PUBLISH_LOG, DB_NAME, EXCLUDE_LIST_MAX_LEN } from './constants';
import database from './database';
import { LogLevel, logMessage } from './logger';

type Question = {
  questionId: number;
  solution: string;
  question: string;
  options: Option[];
  isActive: boolean;
};

type Option = {
  optionId: number;
  optionText: string;
  isCorrect: boolean;
};

class GameQuestion {
  nextQuestion: Question;
  excludeList: Question[];
  constructor() {
    this.nextQuestion = null;
    this.excludeList = [];
  }

  next() {
    if (!this.nextQuestion) {
      logMessage(
        LogLevel.ERROR,
        'nextQuestion not found. `loadNext` should have been called first!'
      );
      return;
    }
    return this.nextQuestion;
  }

  addToExcludeList(question: Question) {
    while (EXCLUDE_LIST_MAX_LEN > 0 && this.excludeList.length >= EXCLUDE_LIST_MAX_LEN) {
      this.excludeList.shift();
    }
    this.excludeList.push(question);
  }

  async loadNext() {
    try {
      logMessage(LogLevel.INFO, 'loading next questions');
      const client = await database.getClient();
      const collection = client.db(DB_NAME).collection(COLL_QUESTIONS);
      const excludeList = this.excludeList.map((q) => q.questionId);
      const pipeline = [
        { $match: { isActive: true, questionId: { $nin: excludeList } } },
        { $sample: { size: 1 } },
        {
          $project: {
            _id: 0,
            questionId: 1,
            solution: 1,
            question: 1,
            options: 1,
            isActive: 1,
          },
        },
      ];
      const result = await collection.aggregate<Question>(pipeline).toArray();
      if (result.length === 0) {
        logMessage(LogLevel.ERROR, 'Error: not able to load next question');
        return;
      }
      const nextQuestion = result[0];
      this.addToExcludeList(nextQuestion);
      this.nextQuestion = nextQuestion;
    } catch (err) {
      logMessage(LogLevel.ERROR, err);
    }
  }

  async publish() {
    try {
      const client = await database.getClient();
      const collection = client.db(DB_NAME).collection(COLL_QUES_PUBLISH_LOG);
      const doc = {
        questionId: this.nextQuestion.questionId,
        question: this.nextQuestion.question,
        timestamp: new Date().getTime(),
      };
      logMessage(LogLevel.INFO, 'saving question to publish log', this.nextQuestion.questionId);
      await collection.insertOne(doc);
    } catch (err) {
      logMessage(LogLevel.ERROR, err);
    }
  }
}

export default GameQuestion;
