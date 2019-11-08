const http2server = require('./http2server');
const getLogger = require('./utils/logger');

const logger = getLogger(__filename.slice(__dirname.length + 1, -3));

const app = http2server();

app.post('/nf-instances', (req, res) => {
  logger.info(req.query);
  logger.info(req.body);
  res.json({});
});

app.get('/group-profiles/gpsi-groups/', (req, res) => {
  res.json([
    {
      groupProfileId: '',
      groupId: 'groupId',
      nfType: ['{}', '{}'],
      gpsiRanges: ['{}', '{}']
    },
    {
      groupProfileId: '',
      groupId: 'groupId',
      nfType: ['{}', '{}'],
      gpsiRanges: ['{}', '{}']
    }
  ]);
});

app.listen(6666);
