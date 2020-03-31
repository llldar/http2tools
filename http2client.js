// eslint-disable-next-line max-classes-per-file
const http2 = require('http2');
const http = require('http');
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
 * A HTTP/2 client.
 *
 * @example
 * const HTTP2Client = require('../../framework/http2Client');
 * const http2client = new HTTP2Client('myService');
 *
 * const myFunc = async () => {
 *   const response = await http2client.fetch('www.example.com');
 *   const responseText = await response.text();
 *   return responseText;
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
    return matchObj ? matchObj.groups : {};
  }

  /**
   * Http2 Fetch
   *
   * Partially implements fetch API with http2
   *
   * supported features:
   * options: method,headers,body
   * method: get,post,put,patch,delete
   * response: headers,status,statusText,ok,json(),text(),arrayBuffer()
   *
   * @param {string} url - the request full url
   * @param {object} options - incudes: method,headers,body
   * @returns {object} response of fetch
   */
  async fetch(url, options = { method: 'GET' }) {
    let { scheme, baseUrl, path } = HTTP2Client.parseUrl(url);

    if (!baseUrl) {
      throw new Http2ClientError('Invalid url', 400, 'Http2Client');
    }
    if (!scheme) {
      scheme = 'http';
    }
    if (!path) {
      path = '';
    }

    baseUrl = `${scheme}://${baseUrl}`;
    const { method = 'GET', headers, body } = options;

    const session = http2.connect(baseUrl);
    session.setTimeout(120000);
    let req;

    switch (method.toUpperCase()) {
      case 'GET':
      case 'DELETE':
        logger.debug(`${method} ${baseUrl}/${path} ${headers ? `header:${headers} ` : ''}`);
        req = session.request({
          [http2.constants.HTTP2_HEADER_SCHEME]: scheme,
          [http2.constants.HTTP2_HEADER_METHOD]: method.toUpperCase(),
          [http2.constants.HTTP2_HEADER_PATH]: `/${path}`,
          ...headers
        });
        break;
      case 'POST':
      case 'PATCH':
      case 'PUT':
        {
          logger.debug(
            `${method} ${baseUrl}/${path} ${headers ? `headers:${headers} ` : ''}${
              body ? `data:${JSON.stringify(body)}` : ''
            }`
          );
          const buffer = Buffer.from(JSON.stringify(body || null));
          req = session.request({
            [http2.constants.HTTP2_HEADER_SCHEME]: scheme,
            [http2.constants.HTTP2_HEADER_METHOD]: method.toUpperCase(),
            [http2.constants.HTTP2_HEADER_PATH]: `/${path}`,
            'Content-Length': buffer.length,
            ...headers
          });
          req.write(buffer);
        }
        break;
      default:
        throw new Http2ClientError('Unsupported Methods', 405, 'Http2Client');
    }

    req.setEncoding('utf8');
    req.end();

    // custom promisify functions for req.on session.on
    // they did not follow the node.js (err, result) callback pattern
    // thus needing custom promisify function
    promisify.custom = fn => event =>
      new Promise(resolve => {
        fn(event, value => {
          resolve(value);
        });
      });

    const response = {};
    const data = [];

    req.on('data', chunk => data.push(chunk));

    (async () => {
      response.headers = await promisify.custom(req.on.bind(req))('response');
      response.status = response.headers[':status'];
      response.statusText = http.STATUS_CODES[response.status];
      response.ok = true;
      if (response.status >= 400) {
        response.ok = false;
      }
    })();

    await Promise.race([
      (async () => {
        await promisify.custom(req.on.bind(req))('end');
        await new Promise(resolve => setTimeout(resolve, 1)); // needed for proper error handling
        logger.debug(`statusCode: ${response.status}`);
        response.text = async () => (data.length ? data.join('') : '');
        response.json = async () => JSON.parse(data.join(''));
        response.arrayBuffer = async () => ArrayBuffer.from(data);
      })(),
      (async () => {
        const err = await promisify.custom(req.on.bind(req))('error');
        throw new Http2ClientError(
          `${err}${data.length > 0 ? `: ${data.join('')}` : ''}`,
          400,
          this.serviceName,
          this.method
        );
      })(),
      (async () => {
        await promisify.custom(session.on.bind(session))('timeout');
        throw new Http2ClientError('Connection Timeout', 408, this.serviceName, this.method);
      })(),
      (async () => {
        const err = await promisify.custom(session.on.bind(session))('error');
        throw new Http2ClientError(err, 400, this.serviceName, this.method);
      })()
    ]);

    session.close();
    return response;
  }
}

module.exports = HTTP2Client;
