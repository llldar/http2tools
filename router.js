const express = require('express');
const getLogger = require('./utils/logger');

const HTTP2Client = require('./http2client');
const asyncHandler = require('./errorHandler');

const logger = getLogger(__filename.slice(__dirname.length + 1, -3));
const router = express.Router();
const http2client = new HTTP2Client('TestService');

router.post(
  '/request',
  asyncHandler(async (req, res) => {
    const { method, url, data } = req.body;
    if (['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(method.toUpperCase())) {
      const result = await http2client[method.toLowerCase()](url, data);
      res.send(result);
    } else {
      res.status(405).end();
    }
  })
);

module.exports = router;
