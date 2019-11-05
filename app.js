const express = require("express");
const { urlencoded, json } = require("body-parser");
const getLogger = require("./utils/logger");
const apiLogger = require("./utils/apiLogger");
const router = require("./router");

const logger = getLogger(__filename.slice(__dirname.length + 1, -3));
const app = express();

// Api logger
app.use(apiLogger);

// Application wide error handling
app.use((req, res, next, err) => {
  logger.error(err);
});

// Setup express
app.use(urlencoded({ extended: false }));
app.use(json());
app.disable("x-powered-by");

// Add routers
app.use("/api", router);

app.get("/", (req, res) => {
  res.send("API Server");
});

// Listen
app
  .listen(process.env.PORT || 8000)
  .on("listening", () => {
    logger.info(`API Server is listening on port ${process.env.PORT || 8000}`);
  })
  .on("error", err => {
    logger.error(err);
  });
