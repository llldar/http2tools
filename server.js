const http2server = require('./http2server');
const getLogger = require('./utils/logger');

const logger = getLogger(__filename.slice(__dirname.length + 1, -3));

const app = http2server();

app.get('/nrf-addresses', (req, res) => {
  logger.info(req.query);
  res.json({
    message: 'get success',
    data: req.query
  });
});

app.get('/nnrf-prov/v1/nrf-addresses', (req, res) => {
  logger.info(req.query);
  res.json({
    message: 'get success',
    data: req.query
  });
});

app.post('/nrf-addresses', (req, res) => {
  logger.info(req.body);
  res.json({
    message: 'post success',
    data: req.body
  });
});

app.post('/nnrf-prov/v1/nrf-addresses', (req, res) => {
  logger.info(req.body);
  res.json({
    message: 'post success',
    data: req.body
  });
});

app.put('/nrf-addresses', (req, res) => {
  logger.info(req.body);
  res.json({
    message: 'put success',
    data: req.body
  });
});

app.patch('/nrf-addresses', (req, res) => {
  logger.info(req.body);
  res.json({
    message: 'patch success',
    data: req.body
  });
});

app.delete('/nrf-addresses', (req, res) => {
  logger.info(req.query);
  res.json({
    message: 'delete success',
    data: req.query
  });
});

app.listen(6666);
