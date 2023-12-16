import { EXCLUDE_LIST_MAX_LEN, USER_VALID_TILL } from './constants';
import database from './database';
import { LogLevel, logMessage } from './logger';

type Question = {
  questionId: number;
  solution: string;
  question: string;
  options: Option[];
  isActive: boolean;
  correctOptionId: number;
};

type Option = {
  optionId: number;
  textValue: string;
};

type NextQuestion = {
  questionId: number;
  question: string;
  options: Option[];
  previousSolution: string;
  validTill: number;
};

class Game {
  nextQuestion: NextQuestion;
  excludeList: Question[];
  previousSolution: string;
  constructor() {
    this.nextQuestion = null;
    this.excludeList = [];
    this.previousSolution = '';
  }

  addToExcludeList(question: Question) {
    while (this.excludeList.length >= EXCLUDE_LIST_MAX_LEN) {
      this.excludeList.shift();
    }
    this.excludeList.push(question);
  }

  async loadNext() {
    try {
      logMessage(LogLevel.INFO, 'loading next questions');
      const excludeList = this.excludeList.map((q) => q.questionId);
      const question = await database.getQuestion<Question>(excludeList);
      if (!question) {
        logMessage(LogLevel.ERROR, 'Error: not able to load next question');
        return;
      }
      this.addToExcludeList(question);
      this.nextQuestion = {
        questionId: question.questionId,
        question: question.question,
        options: question.options,
        previousSolution: this.previousSolution,
        validTill: 0,
      };
      this.previousSolution = question.solution;
    } catch (err) {
      logMessage(LogLevel.ERROR, err);
    }
  }

  async publish() {
    try {
      logMessage(LogLevel.INFO, 'saving question to publish log', this.nextQuestion.questionId);
      const questionId = this.nextQuestion.questionId;
      const question = this.nextQuestion.question;
      const validTill = new Date().getTime() + USER_VALID_TILL;
      await database.saveToPublishLog(questionId, question, validTill);
      this.nextQuestion.validTill = validTill;
      return this.nextQuestion;
    } catch (err) {
      logMessage(LogLevel.ERROR, err);
    }
  }
}

export default Game;
