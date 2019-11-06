const http2 = require("http2");
const { promisify } = require("util");
const getLogger = require("./utils/logger");

const logger = getLogger("http2Client");

/**
 * Example usage:
 * ```
 * const HTTP2Client = require('../../framework/http2Client');
 * const myFunc = async () => {
 *   const result = await HTTP2Client.get('www.example.com');
 *   logger.info(result);
 * };
 * ```
 * Caveat: this http2Client Currently only working on HTTP2
 * supported servers and will crash if used on HTTP1 servers
 */
class HTTP2Client {
  static parseUrl(url) {
    const regex = /(?<baseUrl>(https:\/\/)?[^/]+)\/?(?<path>.+)?/;
    const matchObj = regex.exec(url);
    const { baseUrl, path } = matchObj.groups;
    return { baseUrl, path };
  }

  static async get(url) {
    return HTTP2Client.request(url, "GET");
  }

  static async post(url, body) {
    return HTTP2Client.request(url, "POST", body);
  }

  static async put(url, body) {
    return HTTP2Client.request(url, "PUT", body);
  }

  static async patch(url, body) {
    return HTTP2Client.request(url, "PATCH", body);
  }

  static async delete(url) {
    return HTTP2Client.request(url, "DELETE");
  }

  /**
   * Http2 Request
   *
   * @param {string} url
   * @param {string} method [GET, POST, PUT, PATCH, DELETE]
   * @param {object} body request body, will only be used when it's POST/PUT/PATCH
   * @param {string} scheme header scheme, default to http
   * @returns {JSON} response of the request, returns empty string "" on error
   */
  static async request(url, method, body = null, scheme = "http") {
    let { baseUrl, path } = HTTP2Client.parseUrl(url);
    const data = [];

    const methodMap = {
      GET: http2.constants.HTTP2_METHOD_GET,
      POST: http2.constants.HTTP2_METHOD_POST,
      PUT: http2.constants.HTTP2_METHOD_PUT,
      PATCH: http2.constants.HTTP2_METHOD_PATCH,
      DELETE: http2.constants.HTTP2_METHOD_DELETE
    };

    if (!baseUrl || baseUrl.length === 0) {
      logger.error(`Invalid url ${baseUrl}`);
    } else {
      if (!baseUrl.includes(scheme)) {
        baseUrl = `${scheme}://${baseUrl}`;
      }
      if (!path) {
        path = "";
      }

      const client = http2.connect(baseUrl);
      let req = null;
      if (["GET", "DELETE"].includes(method.toUpperCase())) {
        req = client.request({
          [http2.constants.HTTP2_HEADER_SCHEME]: scheme,
          [http2.constants.HTTP2_HEADER_METHOD]:
            methodMap[method.toUpperCase()],
          [http2.constants.HTTP2_HEADER_PATH]: `/${path}`
        });
      } else if (["POST", "PATCH", "PUT"].includes(method.toUpperCase())) {
        const buffer = Buffer.from(JSON.stringify(body));
        req = client.request({
          [http2.constants.HTTP2_HEADER_SCHEME]: scheme,
          [http2.constants.HTTP2_HEADER_METHOD]:
            methodMap[method.toUpperCase()],
          [http2.constants.HTTP2_HEADER_PATH]: `/${path}`,
          "Content-Type": "application/json",
          "Content-Length": buffer.length
        });
        req.write(buffer);
      } else {
        logger.error(
          `Invalid method passed to http2Client, only supports ${Object.keys(
            methodMap
          ).join(", ")}`
        );
      }

      if (req) {
        req.setEncoding("utf8");

        req.on("data", chunk => {
          data.push(chunk);
        });

        req.end();
        await promisify(req.on.bind(req))("end");
      }

      client.close();
    }
    return data.join();
  }
}

module.exports = HTTP2Client;
