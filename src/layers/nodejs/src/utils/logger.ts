import * as winston from 'winston';

const { createLogger, format, transports } = winston;
const { combine } = format;

// Define custom log levels
const levels = {
  error: 0,
  alert: 0,
  event: 1,
  context: 1,
  info: 1,
  success: 4,
};

const customFormat = combine(
  format.errors({ stack: true }),
  format.json(),
);

export const logger = createLogger({
  format: combine(customFormat),
  levels: levels,
  transports: [new transports.Console({ level: 'success' })],
}) as winston.Logger & Record<keyof typeof levels, winston.LeveledLogMethod>;
