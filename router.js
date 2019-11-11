const express = require('express');
const getLogger = require('./utils/logger');

const HTTPClient = require('./httpclient');
const asyncHandler = require('./errorHandler');

const logger = getLogger(__filename.slice(__dirname.length + 1, -3));
const router = express.Router();

router.post(
  '/request',
  asyncHandler(async (req, res) => {
    const { method, url, data } = req.body;
    if (['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(method.toUpperCase())) {
      const result = await HTTPClient[method.toLowerCase()](url, data);
      res.send(result);
    } else {
      res.status(405).end();
    }
  })
);

module.exports = router;
