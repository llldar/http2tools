const http2 = require('http2');
const { promisify } = require('util');
const getLogger = require('./utils/logger');

// eslint-disable-next-line spaced-comment
/// <reference type="./http2server.d.ts" />

const logger = getLogger(__filename.slice(__dirname.length + 1, -3));

class CustomHttp2Server {
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
          if (element.route.includes('{')) {
            const regexP = /^(?<basePath>[^{]+){(?<param>[^}]+)}$/;
            const matchP = regexP.exec(element.route);
            if (matchP) {
              const { basePath, param } = matchP.groups;
              if (requestPath.includes(basePath) && element.mehtod === requestMethod) {
                params[param] = requestPath.replace(basePath, '');
                return true;
              }
            }
          }
          if (element.route === requestPath && element.mehtod === requestMethod) {
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
          data: 'defaultData',
          type: 'application/json',
          statusCode: null,
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

  get(route, router) {
    this.addRouter('GET', route, router);
  }

  post(route, router) {
    this.addRouter('POST', route, router);
  }

  put(route, router) {
    this.addRouter('PUT', route, router);
  }

  patch(route, router) {
    this.addRouter('PATCH', route, router);
  }

  delete(route, router) {
    this.addRouter('DELETE', route, router);
  }

  addRouter(mehtod, route, router) {
    this.routers.push({ route, mehtod, router });
  }
}

const getHttp2Server = () => new CustomHttp2Server();

module.exports = getHttp2Server;
