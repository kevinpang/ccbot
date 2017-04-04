var winston = require('winston');

var fileTransports = {
  warn: new winston.transports.File({
    filename: 'logs/warn.txt',
    maxsize: 1000000,
    maxFiles: 10,
    level: 'warn'
  }),
  info: new winston.transports.File({
    filename: 'logs/info.txt',
    maxsize: 1000000,
    maxFiles: 10,
    level: 'info'
  }),
  debug: new winston.transports.File({
    filename: 'logs/debug.txt',
    maxsize: 1000000,
    maxFiles: 10,
    level: 'debug'
  })
};
fileTransports.warn.name = 'file.warn';
fileTransports.info.name = 'file.info';
fileTransports.debug.name = 'file.debug';

var consoleTransport = new winston.transports.Console({
  colorize: true,
  timestamp: true
});

module.exports = new winston.Logger({
  transports: [
    fileTransports.warn,
    fileTransports.info,
    fileTransports.debug,
    consoleTransport
  ]
});