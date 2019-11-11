const getLogger = require('./utils/logger');

const logger = getLogger(__filename.slice(__dirname.length + 1, -3));

const asyncHandler = fn => async (...args) => {
  try {
    await fn(...args);
  } catch (err) {
    logger.error(err);

    const resFn = args.find(arg => arg.name === 'res');
    if (resFn) {
      let errors = {
        message: 'Internal Sever Error',
        error: err
      };

      if (err.name === 'NRFError') {
        errors = {
          message: 'NRF Error',
          error: err,
          statusCode: err.statusCode
        };
      }

      resFn.status(errors.statusCode || 500).json(errors);
    }
  }
};

module.exports = asyncHandler;
