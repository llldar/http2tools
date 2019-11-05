const getLogger = require('./logger');
const colors = require('./color');

const logger = getLogger('api');

module.exports = (req, res, next) => {
  res.on('finish', () => {
    logger.info(
      `${req.method} ${colors.FgCyan}${req.originalUrl} ${colors.FgYellow}${res.statusCode}`
    );
  });

  next();
};
