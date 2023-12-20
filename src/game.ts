import { EXCLUDE_LIST_MAX_LEN } from './constants';
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
};

class Game {
  private static _instance: Game;
  private nextQuestion: NextQuestion;
  private previousQuestions: Question[];
  private activeQuestion: Question;

  private constructor() {
    this.nextQuestion = null;
    this.activeQuestion = null;
    this.previousQuestions = [];
  }

  public static getInstance(): Game {
    if (!this._instance) {
      this._instance = new Game();
    }
    return this._instance;
  }

  public addToPreviousList(question: Question) {
    while (this.previousQuestions.length >= EXCLUDE_LIST_MAX_LEN) {
      this.previousQuestions.shift();
    }
    this.previousQuestions.push(question);
  }

  public lastQuestion() {
    const len = this.previousQuestions.length;
    if (len === 0) {
      return null;
    }
    const last = this.previousQuestions[len - 1];
    return last;
  }

  public async loadNext() {
    try {
      logMessage(LogLevel.INFO, 'loading next questions');
      const excludeList = this.previousQuestions.map((q) => q.questionId);
      const question = await database.getQuestion<Question>(excludeList);
      if (!question) {
        logMessage(LogLevel.ERROR, 'Error: not able to load next question');
        return;
      }
      this.addToPreviousList(question);
      this.nextQuestion = {
        questionId: question.questionId,
        question: question.question,
        options: question.options,
        previousSolution: this.activeQuestion?.solution || '',
      };
    } catch (err) {
      logMessage(LogLevel.ERROR, err);
    }
  }

  public publish() {
    try {
      if (this.nextQuestion.questionId !== this.lastQuestion()?.questionId) {
        const msg = `unexpected mismatch, last questionId: ${
          this.lastQuestion()?.questionId
        }, next questionId: ${this.nextQuestion.questionId}`;
        throw new Error(msg);
      }
      logMessage(LogLevel.INFO, 'saving question to publish log', this.nextQuestion.questionId);
      this.activeQuestion = this.lastQuestion();
      const questionId = this.nextQuestion.questionId;
      const question = this.nextQuestion.question;
      database.saveToPublishLog(questionId, question);
      return this.nextQuestion;
    } catch (err) {
      logMessage(LogLevel.ERROR, err);
    }
  }

  public checkAnswer(questionId: number, selectedOptionId: number) {
    if (!this.activeQuestion) {
      throw new Error('activeQuestion is not set');
    }
    if (this.activeQuestion.questionId !== questionId) {
      throw new Error(`questionId: ${questionId} is not active`);
    }
    return this.activeQuestion.correctOptionId === selectedOptionId;
  }
}

export default Game;
