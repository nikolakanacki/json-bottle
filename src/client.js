const net = require('net');
const JSONBottleInterface = require('./interface');

/**
 * JSONBottleClient
 * @class
 * @extends JSONBottleInterface
 * @example
 * const JSONBottleClient = require('json-bottle').Client;
 * const client = new JSONBottleClient();
 */
class JSONBottleClient extends JSONBottleInterface {

  /**
   * Start JSONBottleClient instance
   * @param {number} port - Port to listen to
   * @param {string} host - Host to bind to
   * @return {JSONBottleClient} - Self instance for chaining
   */
  start(port, host) {
    return this.stop(() => {
      const socket = new net.Socket();
      socket._id = 'main';
      this.setupSocket(socket);
      this.once('disconnect', () => {
        if (!Object.values(this._sockets).length) {
          setTimeout(() => this.start(port, host), 1000);
        }
      });
      socket.connect(port, host, () => this.emit('started'));
    });
  }

  /**
   * Stop JSONBottleClient instance
   * @param {function} [cb] - Callback invoked once the client has stopped
   * @return {JSONBottleClient} - Self instance for chaining
   */
  stop(cb) {
    this.clearPendingRequests(new Error('Client stopped.'));
    this.destroyAllSockets();
    this.once('stopped', () => cb && cb());
    setTimeout(() => this.emit('stopped'));
    return this;
  }

}

module.exports = JSONBottleClient;
