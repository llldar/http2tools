const http2 = require("http2");

const server = http2.createServer();
const getLogger = require("./utils/logger");
const logger = getLogger(__filename.slice(__dirname.length + 1, -3));

server
  .listen(process.env.PORT || 6666)
  .on("stream", (stream, headers) => {
    logger.info(`Request detected.`);
    stream.respond({
      "content-type": "text/html",
      ":status": 200
    });
    stream.end("<h1>H2c Server</h1>");
  })
  .on("listening", () => {
    logger.info(`H2C Server is listening on port ${process.env.PORT || 6666}`);
  });
