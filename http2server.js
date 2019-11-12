const http2 = require('http2');
const { promisify } = require('util');
const getLogger = require('./utils/logger');

const logger = getLogger(__filename.slice(__dirname.length + 1, -3));

/**
 * Caveat: this HTTP2 server is experimental
 * should only be used to test HTTP2 client
 * The basic usage is like epxress but it's not express
 * you cannot pass express middleware or router to it
 *
 * supports
 * req -> param query body (param should be in {} not after :)
 * res -> send json status
 *
 * @example
 * const HTTP2Server = require('../../framework/http2/server');
 * const app = new HTTP2Server();
 *
 * app.get('/your-path/{id}', (req, res) => {
 *   logger.info(req.query);
 *   res.json({
 *     message: 'get success',
 *     data: req.query
 *   });
 * });
 *
 * app.post('/your-path', (req, res) => {
 *   logger.info(req.body);
 *   res.json({
 *     message: 'post success',
 *     data: req.body
 *   });
 * });
 *
 * app.listen(1234);
 */
class HTTP2Server {
  constructor() {
    this.server = http2.createServer();
    this.routers = [];
  }

  listen(port) {
    this.server
      .listen(port || 6666)
      .on('request', async (req, res) => {
        const requestData = [];
        let requestPath = req.headers[':path'];
        const requestMethod = req.headers[':method'];

        req.on('data', chunk => {
          requestData.push(chunk);
        });
        await promisify(req.on.bind(req))('end');
        logger.info(`${req.headers[':method']} ${req.headers[':path']}`);
        const params = {};
        const querys = {};
        const regexQ = /^(?<path>\/[^?]+)(?:(?:\?([^=]+=[^&]+))(?:&([^=]+=[^&]+))*)?$/;
        const matchQ = regexQ.exec(requestPath);
        if (matchQ) {
          requestPath = matchQ.groups.path;
          const usefulMatches = matchQ.filter(m => m && m.includes('=') && !m.includes('?'));
          usefulMatches.forEach(matched => {
            const value = matched.substring(matched.indexOf('=') + 1);
            const name = matched.substring(0, matched.indexOf('='));
            querys[name] = value;
          });
        }

        const routeObj = this.routers.find(element => {
          if (element.path.includes('{')) {
            const regexP = /^(?<basePath>[^{]+){(?<param>[^}]+)}$/;
            const matchP = regexP.exec(element.path);
            if (matchP) {
              const { basePath, param } = matchP.groups;
              if (requestPath.includes(basePath) && element.mehtod === requestMethod) {
                params[param] = requestPath.replace(basePath, '');
                return true;
              }
            }
          }
          if (element.path === requestPath && element.mehtod === requestMethod) {
            return true;
          }
          return false;
        });
        const customRequest = {
          query: querys,
          param: params,
          body: requestData && requestData.length > 0 ? JSON.parse(requestData.join('')) : null
        };
        const customResponse = {
          data: '',
          type: 'application/json',
          statusCode: 200,
          send(obj) {
            this.data = obj;
            this.type = 'text/html';
          },
          json(obj) {
            this.data = obj;
            this.type = 'application/json';
          },
          status(code) {
            this.statusCode = code;
          }
        };
        if (routeObj) {
          routeObj.router(customRequest, customResponse);
          res.writeHead(customResponse.statusCode || 200, {
            'content-type': customResponse.type
          });
          const buffer = Buffer.from(JSON.stringify(customResponse.data));
          res.write(buffer);
        } else {
          res.writeHead(404, {});
        }
        res.end();
        await promisify(res.on.bind(res))('end');
      })
      .on('listening', () => {
        logger.info(`HTTP2 Server is listening on port ${port || 6666}`);
      })
      .on('error', err => {
        logger.error(err);
      });
  }

  get(path, router) {
    this.addRouter('GET', path, router);
  }

  post(path, router) {
    this.addRouter('POST', path, router);
  }

  put(path, router) {
    this.addRouter('PUT', path, router);
  }

  patch(path, router) {
    this.addRouter('PATCH', path, router);
  }

  delete(path, router) {
    this.addRouter('DELETE', path, router);
  }

  addRouter(mehtod, path, router) {
    this.routers.push({ path, mehtod, router });
  }
}

module.exports = HTTP2Server;
