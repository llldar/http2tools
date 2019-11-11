const getLogger = require('./utils/logger');

const logger = getLogger(__filename.slice(__dirname.length + 1, -3));

const asyncHandler = fn => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    logger.error(err);

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

    res.status(errors.statusCode || 500).json(errors);
  }
};

module.exports = asyncHandler;
