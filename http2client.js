// eslint-disable-next-line max-classes-per-file
const http2 = require('http2');
const { promisify } = require('util');
const getLogger = require('./utils/logger');

const logger = getLogger('http2Client');

/**
 * Custom Error type for Http2Client
 */
class Http2ClientError extends Error {
  constructor(message = '', statusCode = 500, serviceName = '') {
    super(message);
    this.name = serviceName;
    this.message = message;
    this.statusCode = statusCode;
  }
}

/**
 * Caveat: this http2Client Currently only working on HTTP2
 * supported servers and will crash if used on HTTP1 servers
 * to support HTTP1, ALPN need to be implemented
 *
 * @example
 * const HTTP2Client = require('../../framework/http2Client');
 * const http2client = new HTTP2Client('myService');
 *
 * const myFunc = async () => {
 *   const result = await http2client.get('www.example.com');
 *   return result;
 * };
 *
 */
class HTTP2Client {
  constructor(serviceName) {
    this.serviceName = serviceName;
  }

  static parseUrl(url) {
    const regex = /^(?:(?<scheme>https?):\/\/)?(?<baseUrl>[^/]+)(?:(?<!\/)\/(?!\/)(?<path>.*))?$/;
    const matchObj = regex.exec(url);
    return matchObj.groups;
  }

  async get(url, header = null) {
    return this.request(url, 'GET', header);
  }

  async post(url, body, header = null) {
    return this.request(url, 'POST', body, header);
  }

  async put(url, body, header = null) {
    return this.request(url, 'PUT', body, header);
  }

  async patch(url, body, header = null) {
    return this.request(url, 'PATCH', body, header);
  }

  async delete(url, header = null) {
    return this.request(url, 'DELETE', header);
  }

  /**
   * Http2 Request
   *
   * @param {string} url - the request full url
   * @param {string} method - [GET, POST, PUT, PATCH, DELETE]
   * @param {object} body - request body, will only be used when it's POST/PUT/PATCH
   * @param {object} header - request headers, manually set headers to override the default headers
   * @param {string} defaultScheme - http or https, default scheme when scheme is not in url, defaults to http
   * @param {number} timeout - request timeout in ms, defaults to 30000
   * @returns {JSON} response of the request, returns null on error
   */
  async request(url, method, body = null, header = null, defaultScheme = 'http', timeout = 30000) {
    let { scheme, baseUrl, path } = HTTP2Client.parseUrl(url);
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
      if (!scheme) {
        scheme = defaultScheme;
      }
      baseUrl = `${scheme}://${baseUrl}`;
      if (!path) {
        path = '';
      }

      const session = http2.connect(baseUrl);
      session.setTimeout(timeout);

      let req = null;

      if (['GET', 'DELETE'].includes(method.toUpperCase())) {
        logger.info(`${method} ${baseUrl}/${path} ${header ? `header:${header} ` : ''}`);
        req = session.request({
          [http2.constants.HTTP2_HEADER_SCHEME]: scheme,
          [http2.constants.HTTP2_HEADER_METHOD]: methodMap[method.toUpperCase()],
          [http2.constants.HTTP2_HEADER_PATH]: `/${path}`,
          ...header
        });
      } else if (['POST', 'PATCH', 'PUT'].includes(method.toUpperCase())) {
        logger.info(
          `${method} ${baseUrl}/${path} ${header ? `header:${header} ` : ''}${
            body ? `data:${body}` : ''
          }`
        );
        const buffer = Buffer.from(JSON.stringify(body));
        req = session.request({
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
          `Invalid method passed to http2Client, only supports ${Object.keys(methodMap).join(', ')}`
        );
        throw new Http2ClientError('Unsupported Methods', 405, 'Http2Client');
      }

      req.setEncoding('utf8');

      // custom promisfy functions for req.on session.on
      // they did not follow the node.js (err, result) callback pattern
      // thus needing custom promisify function
      req.on[promisify.custom] = event =>
        new Promise(resolve => {
          req.on(event, value => {
            resolve(value);
          });
        });

      session.on[promisify.custom] = event =>
        new Promise(resolve => {
          session.on(event, value => {
            resolve(value);
          });
        });

      req.on[promisify.custom]
        .bind(req)('data')
        .then(chunk => data.push(chunk));

      await Promise.race([
        (async () => {
          const headers = await req.on[promisify.custom].bind(req)('response');
          const statusCode = headers[':status'];
          logger.debug(`statusCode: ${statusCode}`);
          if (statusCode >= 400) {
            throw new Http2ClientError(`${this.serviceName} Error`, statusCode, this.serviceName);
          }
          return true;
        })(),
        (async () => {
          const err = await req.on[promisify.custom].bind(req)('error');
          logger.error(err);
          throw new Http2ClientError('Bad Request', 400, this.serviceName);
        })(),
        (async () => {
          await session.on[promisify.custom].bind(session)('timeout');
          throw new Http2ClientError('Connection Timeout', 408, this.serviceName);
        })(),
        (async () => {
          await session.on[promisify.custom].bind(session)('error');
          throw new Http2ClientError('Bad Request', 400, this.serviceName);
        })()
      ]);

      req.end();
      await promisify(req.on.bind(req))('end');

      session.close();
      await promisify(session.on.bind(session))('close');
    }

    if (data && data.length > 0) {
      return data.join();
    }

    return null;
  }
}

module.exports = HTTP2Client;
