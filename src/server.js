const debug = require('debug')('json-bottle:server');
const net = require('net');
const util = require('./util');
const JSONBottleInterface = require('./interface');

/**
 * JSONBottleServer
 * @class
 * @extends JSONBottleInterface
 * @example
 * const JSONBottleServer = require('json-bottle').Server;
 * const server = new JSONBottleServer();
 */
class JSONBottleServer extends JSONBottleInterface {

  /**
   * Start JSONBottleServer instance
   * @param {number} port - Port to listen to
   * @param {string} host - Host to bind to
   * @return {JSONBottleServer}  - Self instance for chaining
   */
  start(port, host) {
    return this.stop(() => {
      this._server = new net.Server();
      this._server.on('error', (error) => {
        debug('Server error: %s', error);
        setTimeout(() => this.start(port, host), 1000);
      });
      this._server.on('connection', (socket) => {
        const socketCandidate = socket;
        socketCandidate._id = util.generateId();
        this.setupSocket(socketCandidate);
        this.emit('connect', socketCandidate);
      });
      this._server.listen(port, host, () => this.emit('started'));
    });
  }

  /**
   * Stop the instance
   * @param {function} cb - Callback function called once the undelying server is stopped
   * @return {JSONBottleServer} - Self instance for chaining
   */
  stop(cb) {
    this.once('stopped', () => cb && cb());
    if (this._server) {
      this._server.removeAllListeners();
      this._server.on('error', () => {});
      this._server.close(() => this.emit('stopped'));
    } else {
      setTimeout(() => this.emit('stopped'));
    }
    this.clearPendingRequests(new Error('Server stopped.'));
    this.destroyAllSockets();
    delete this._server;
    return this;
  }
}

module.exports = JSONBottleServer;
