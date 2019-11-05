/* eslint-disable no-console */
const colors = require('./color');

class Logger {
  constructor(componentName) {
    this.componentName = componentName;
  }

  static log(logLevel, componentName, message) {
    if (typeof message === 'object') {
      message = JSON.stringify(message);
    }
    const time = new Date();
    let color = colors.FgWhite;
    switch (logLevel) {
      case 'Info':
        color = colors.FgGreen;
        break;
      case 'Error':
        color = colors.FgRed;
        break;
      case 'Debug':
        color = colors.FgCyan;
        break;
      case 'Warn':
        color = colors.FgYellow;
        break;
      default:
        color = colors.FgWhite;
        break;
    }
    console.log(
      `${time.toISOString()} - ${color}[${logLevel}][${componentName}] ${message}${colors.Reset}`
    );
  }

  static raw(message) {
    console.log(message);
  }

  info(message) {
    Logger.log('Info', this.componentName, message);
  }

  error(message) {
    Logger.log('Error', this.componentName, message);
  }

  debug(message) {
    Logger.log('Debug', this.componentName, message);
  }

  warn(message) {
    Logger.log('Warn', this.componentName, message);
  }
}

const getLogger = componentName => new Logger(componentName);

module.exports = getLogger;
