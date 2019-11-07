const http2 = require("http2");
const { promisify } = require("util");
const server = http2.createServer();
const getLogger = require("./utils/logger");
const logger = getLogger(__filename.slice(__dirname.length + 1, -3));

///<reference path="./server.d.ts" />

server
  .listen(process.env.PORT || 6666)
  // .on("stream", (stream, headers) => {
  //   logger.info(`Request detected.`);
  //   stream.respond({
  //     "content-type": "text/html",
  //     ":status": 200
  //   });
  //   stream.end("<h1>H2c Server</h1>");
  // })
  .on("request", async (req, res) => {
    const data = [];
    req.on("data", chunk => {
      data.push(chunk);
    });
    await promisify(req.on.bind(req))("end");
    logger.info(`headers: ${JSON.stringify(req.headers)}`);
    if (req.headers[":method"] === "GET") {
      logger.info("get");
    }
    if (req.headers[":method"] === "POST") {
      logger.info("post");
    }

    res.end();
  })
  .on("listening", () => {
    logger.info(`H2C Server is listening on port ${process.env.PORT || 6666}`);
  });

module.exports = server;
