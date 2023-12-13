export enum LogLevel {
  INFO,
  WARN,
  ERROR,
}

export function logMessage(level: LogLevel, ...message: any[]) {
  const ts = new Date().toLocaleString();
  if (level === LogLevel.INFO) {
    console.log(ts, ...message);
  } else if (level === LogLevel.WARN) {
    console.warn(ts, ...message);
  } else {
    console.error(ts, ...message);
  }
}
