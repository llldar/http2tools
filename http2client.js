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
 * A HTTP/2 client.
 * Note: Use 'fetch' for HTTP/1 calls.
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
    this.methodMap = {
      GET: http2.constants.HTTP2_METHOD_GET,
      POST: http2.constants.HTTP2_METHOD_POST,
      PUT: http2.constants.HTTP2_METHOD_PUT,
      PATCH: http2.constants.HTTP2_METHOD_PATCH,
      DELETE: http2.constants.HTTP2_METHOD_DELETE
    };
  }

  static parseUrl(url) {
    const regex = /^(?:(?<scheme>https?):\/\/)?(?<baseUrl>[^/]+)(?:(?<!\/)\/(?!\/)(?<path>.*))?$/;
    const matchObj = regex.exec(url);
    return matchObj ? matchObj.groups : {};
  }

  async get(url, header) {
    return this.request(url, 'GET', header);
  }

  async post(url, body, header) {
    return this.request(url, 'POST', body, header);
  }

  async put(url, body, header) {
    return this.request(url, 'PUT', body, header);
  }

  async patch(url, body, header) {
    return this.request(url, 'PATCH', body, header);
  }

  async delete(url, header) {
    return this.request(url, 'DELETE', header);
  }

  /**
   * Http2 Fetch
   *
   * partially implements fetch API with http2
   *
   * supported features:
   * init: method,headers,body
   * mothod: get,post,put,patch,delete
   * response: headers,status,statusText,ok,json(),text(),arrayBuffer()
   *
   * @param {string} url - the request full url
   * @param {object} initObj - incudes: method,headers,body
   * @returns {object} response of fetch
   */
  async fetch(url, initObj) {
    let { scheme, baseUrl, path } = HTTP2Client.parseUrl(url);

    if (!baseUrl || baseUrl.length === 0) {
      throw new Http2ClientError('Invalid url', 400, 'Http2Client');
    }
    if (!scheme) {
      scheme = 'http';
    }
    baseUrl = `${scheme}://${baseUrl}`;
    if (!path) {
      path = '';
    }

    const { method, headers, body } = initObj;
    const session = http2.connect(baseUrl);
    let req;

    switch (method.toUpperCase()) {
      case 'GET':
      case 'DELETE':
        logger.debug(`${method} ${baseUrl}/${path} ${headers ? `header:${headers} ` : ''}`);
        req = session.request({
          [http2.constants.HTTP2_HEADER_SCHEME]: scheme,
          [http2.constants.HTTP2_HEADER_METHOD]: this.methodMap[method.toUpperCase()],
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
            [http2.constants.HTTP2_HEADER_METHOD]: this.methodMap[method.toUpperCase()],
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

    const fetchResponse = {};
    const data = [];

    req.on('data', chunk => data.push(chunk));

    (async () => {
      fetchResponse.headers = await promisify.custom(req.on.bind(req))('response');
      fetchResponse.status = fetchResponse.headers[':status'];
      fetchResponse.statusText = `${fetchResponse.status}`;
      fetchResponse.ok = true;
      if (fetchResponse.status >= 400) {
        fetchResponse.ok = false;
      }
    })();

    await Promise.race([
      (async () => {
        await promisify.custom(req.on.bind(req))('end');
        await new Promise(resolve => setTimeout(resolve, 1)); // needed for proper error handling
        logger.debug(`statusCode: ${fetchResponse.status}`);
        fetchResponse.text = () => (data.length ? data.join('') : '');
        fetchResponse.json = () => (data.length ? JSON.parse(data.join('')) : {});
        fetchResponse.arrayBuffer = () => ArrayBuffer.from(data);
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
        const err = await promisify.custom(session.on.bind(session))('error');
        throw new Http2ClientError(err, 400, this.serviceName, this.method);
      })()
    ]);

    session.close();
    return fetchResponse;
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
   * @returns {JSON} response of the request, returns empty Object {} if there is no response data
   */
  async request(url, method, body, header, defaultScheme = 'http', timeout = 30000) {
    let { scheme, baseUrl, path } = HTTP2Client.parseUrl(url);

    if (!baseUrl || baseUrl.length === 0) {
      throw new Http2ClientError('Invalid url', 400, 'Http2Client');
    }
    if (!scheme) {
      scheme = defaultScheme;
    }
    baseUrl = `${scheme}://${baseUrl}`;
    if (!path) {
      path = '';
    }

    const session = http2.connect(baseUrl);
    session.setTimeout(timeout);

    let req;

    switch (method.toUpperCase()) {
      case 'GET':
      case 'DELETE':
        logger.debug(`${method} ${baseUrl}/${path} ${header ? `header:${header} ` : ''}`);
        req = session.request({
          [http2.constants.HTTP2_HEADER_SCHEME]: scheme,
          [http2.constants.HTTP2_HEADER_METHOD]: this.methodMap[method.toUpperCase()],
          [http2.constants.HTTP2_HEADER_PATH]: `/${path}`,
          ...header
        });
        break;
      case 'POST':
      case 'PATCH':
      case 'PUT':
        {
          logger.debug(
            `${method} ${baseUrl}/${path} ${header ? `header:${header} ` : ''}${
              body ? `data:${body}` : ''
            }`
          );
          const buffer = Buffer.from(JSON.stringify(body || null));
          req = session.request({
            [http2.constants.HTTP2_HEADER_SCHEME]: scheme,
            [http2.constants.HTTP2_HEADER_METHOD]: this.methodMap[method.toUpperCase()],
            [http2.constants.HTTP2_HEADER_PATH]: `/${path}`,
            'Content-Length': buffer.length,
            ...header
          });
          req.write(buffer);
        }
        break;
      default:
        throw new Http2ClientError('Unsupported Methods', 405, 'Http2Client');
    }

    req.setEncoding('utf8');
    req.end();

    // custom promisfy functions for req.on session.on
    // they did not follow the node.js (err, result) callback pattern
    // thus needing custom promisify function
    promisify.custom = fn => event =>
      new Promise(resolve => {
        fn(event, value => {
          resolve(value);
        });
      });

    const data = [];
    let statusCode;

    req.on('data', chunk => data.push(chunk));

    (async () => {
      const headers = await promisify.custom(req.on.bind(req))('response');
      statusCode = headers[':status'];
    })();

    const response = await Promise.race([
      (async () => {
        await promisify.custom(req.on.bind(req))('end');
        await new Promise(resolve => setTimeout(resolve, 1)); // needed for proper error handling
        logger.debug(`statusCode: ${statusCode}`);
        if (statusCode >= 400) {
          throw new Http2ClientError(
            `${this.serviceName} Error${data.length > 0 ? `: ${data.join('')}` : ''}`,
            statusCode,
            this.serviceName
          );
        }
        return data.length > 0 ? data.join('') : {};
      })(),
      (async () => {
        const err = await promisify.custom(req.on.bind(req))('error');
        throw new Http2ClientError(
          `${err}${data.length > 0 ? `: ${data.join('')}` : ''}`,
          400,
          this.serviceName
        );
      })(),
      (async () => {
        await promisify.custom(session.on.bind(session))('timeout');
        throw new Http2ClientError('Connection Timeout', 408, this.serviceName);
      })(),
      (async () => {
        const err = await promisify.custom(session.on.bind(session))('error');
        throw new Http2ClientError(err, 400, this.serviceName);
      })()
    ]);

    session.close();
    return response;
  }
}

module.exports = HTTP2Client;
