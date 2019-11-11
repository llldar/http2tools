// eslint-disable-next-line max-classes-per-file
const http2 = require('http2');
const { promisify } = require('util');
const getLogger = require('./utils/logger');

const logger = getLogger('http2Client');

/**
 * Custom Error type for NRF
 */
class NRFError extends Error {
  constructor(message = '', statusCode = 500) {
    super(message);
    this.name = 'NRFError';
    this.message = message;
    this.statusCode = statusCode;
  }
}

/**
 * Example usage:
 * ```
 * const HTTP2Client = require('../../framework/http2Client');
 * const myFunc = async () => {
 *   const result = await HTTP2Client.get('www.example.com');
 *   return result;
 * };
 * ```
 * Caveat: this http2Client Currently only working on HTTP2
 * supported servers and will crash if used on HTTP1 servers
 * to support HTTP1, ALPN need to be implemented
 *
 */
class HTTP2Client {
  static parseUrl(url) {
    const regex = /^(?:(?<scheme>https?):\/\/)?(?<baseUrl>[^/]+)(?:(?<!\/)\/(?!\/)(?<path>.*))?$/;
    const matchObj = regex.exec(url);
    return matchObj.groups;
  }

  static async get(url, header = null) {
    return HTTP2Client.request(url, 'GET', header);
  }

  static async post(url, body, header = null) {
    return HTTP2Client.request(url, 'POST', body, header);
  }

  static async put(url, body, header = null) {
    return HTTP2Client.request(url, 'PUT', body, header);
  }

  static async patch(url, body, header = null) {
    return HTTP2Client.request(url, 'PATCH', body, header);
  }

  static async delete(url, header = null) {
    return HTTP2Client.request(url, 'DELETE', header);
  }

  /**
   * Http2 Request
   *
   * @param {string} url
   * @param {string} method [GET, POST, PUT, PATCH, DELETE]
   * @param {object} body request body, will only be used when it's POST/PUT/PATCH
   * @param {object} header request headers, manually set headers to override the default headers
   * @param {string} defaultScheme http/https default scheme when scheme is not in url
   * @param {number} timeout request timeout in ms
   * @returns {JSON} response of the request, returns null on error
   */
  static async request(
    url,
    method,
    body = null,
    header = null,
    defaultScheme = 'http',
    timeout = 30000
  ) {
    try {
      let { scheme, baseUrl, path } = HTTP2Client.parseUrl(url);
      const data = [];
      let error = null;

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
        if (!scheme) {
          scheme = defaultScheme;
        }
        baseUrl = `${scheme}://${baseUrl}`;
        if (!path) {
          path = '';
        }

        const client = http2.connect(baseUrl);
        client.setTimeout(timeout);
        client.on('timeout', () => {
          error = new NRFError('HTTP2 Connection Timeout', 408);
        });

        client.on('error', err => {
          logger.error(err);
        });

        let req = null;
        logger.debug(`scheme: ${scheme}`);
        logger.debug(`url: ${baseUrl}`);
        logger.debug(`method: ${method}`);
        logger.debug(`path: /${path}`);
        if (['GET', 'DELETE'].includes(method.toUpperCase())) {
          req = client.request({
            [http2.constants.HTTP2_HEADER_SCHEME]: scheme,
            [http2.constants.HTTP2_HEADER_METHOD]: methodMap[method.toUpperCase()],
            [http2.constants.HTTP2_HEADER_PATH]: `/${path}`,
            ...header
          });
        } else if (['POST', 'PATCH', 'PUT'].includes(method.toUpperCase())) {
          const buffer = Buffer.from(JSON.stringify(body));
          req = client.request({
            [http2.constants.HTTP2_HEADER_SCHEME]: scheme,
            [http2.constants.HTTP2_HEADER_METHOD]: methodMap[method.toUpperCase()],
            [http2.constants.HTTP2_HEADER_PATH]: `/${path}`,
            'Content-Type': 'application/json',
            'Content-Length': buffer.length,
            ...header
          });
          req.write(buffer);
        } else {
          logger.error(
            `Invalid method passed to http2Client, only supports ${Object.keys(methodMap).join(
              ', '
            )}`
          );
        }

        if (req) {
          req.setEncoding('utf8');

          req.on('data', chunk => {
            data.push(chunk);
          });

          req.on('error', err => {
            logger.error(err);
          });

          req.on('response', headers => {
            const statusCode = headers[':status'];
            logger.debug(`statusCode: ${statusCode}`);
            if (statusCode >= 400) {
              error = new NRFError('Error happended in NRF Server', statusCode);
            }
          });

          req.end();
          await promisify(req.on.bind(req))('end');

          if (error) {
            throw error;
          }
        }

        client.close();
      }

      if (data && data.length > 0) {
        return data.join();
      }
      return null;
    } catch (err) {
      if (err.name === 'NRFError') {
        throw err;
      }
      logger.error(err);
      return null;
    }
  }
}

module.exports.NRFError = NRFError;
module.exports = HTTP2Client;
