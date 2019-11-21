const getLogger = require('./utils/logger');

const logger = getLogger(__filename.slice(__dirname.length + 1, -3));

const asyncHandler = fn => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    const error = {
      message: err.message || 'Internal Sever Error',
      statusCode: err.statusCode
    };

    logger.error(error);

    res.status(error.statusCode || 500).json(error);
  }
};

module.exports = asyncHandler;
