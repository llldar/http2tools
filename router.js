const getLogger = require("./utils/logger");
const express = require("express");

const HTTPClient = require("./httpclient");

const logger = getLogger(__filename.slice(__dirname.length + 1, -3));
const router = express.Router();

router.get("/get", async (req, res) => {
  const { url } = req.query;
  const result = await HTTPClient.get(url);
  res.send(result);
});

module.exports = router;
