const debug = require('debug')('json-bottle:interface');
const util = require('./util');
const EventEmitter = require('event-emitter-es6');
const JSONBottleMessage = require('./message');

const isArray = require('lodash/isArray');
const isString = require('lodash/isString');
const isObject = require('lodash/isObject');
const isFunction = require('lodash/isFunction');

/**
 * Node net socket
 * @external Socket
 * @see {@link https://nodejs.org/api/net.html#net_class_net_socket}
 */

/**
 * Interface configuration object
 * @typedef {object} JSONBottleInterface~config
 * @property {number} [timeout=10000] - Default timeout to use for the requests
 */

/**
 * Incoming message handler object
 * @typedef {object} JSONBottleInterface~incomingMessageHandler
 * @property {RegExp|null}                                        test     - Path tester
 * @property {JSONBottleInterface~incomingMessageHandlerCallback} callback - Handler callback
 */

/**
 * Incoming message handler callback
 * @callback JSONBottleInterface~incomingMessageHandlerCallback
 * @param {JSONBottleMessage} message - Incoming message being handled
 */

/**
 * Outgoing message callback
 * @callback JSONBottleInterface~outgoingMessageCallback
 * @param {(Error|null)} error - The last error detected while sending to all destination sockets. No error will not abort the sending process.
 */

/**
 * JSONBottleInterface
 * @class
 * @example
 * const JSONBottleInterface = require('json-bottle').Interface;
 * const iface = new JSONBottleInterface();
 */
class JSONBottleInterface extends EventEmitter {

  /**
   * Constructor
   * @param {JSONBottleInterface~config} [config] - Interface configuration
   */
  constructor(config) {
    super({
      emitDelay: 0,
      strictMode: false,
    });
    this._config = Object.assign({
      timeout: 10000,
    }, config);
    this._sockets = {};
    this._handlers = [];
    this._requests = {};
  }

  /**
   * Get config key
   * @param {string} key - Key to get the config for
   * @return {mixed} - Value for the key or undefined
   */
  getConfig(key) {
    return this._config[key];
  }

  /**
   * Get socket by ID
   * @param {string} id - Socket id
   * @return {(external:Socket|undefined)} - Socket with the passed id or undefined
   */
  getSocket(id) {
    return this._sockets[id];
  }

  /**
   * Get all sockets as array
   * @return {external:Socket[]} - All sockets
   */
  getSockets() {
    return Object.values(this._sockets);
  }

  /**
   * Setup socket
   * @param {external:Socket} socket - Socket to setup
   * @return {external:Socket} - Passed socket
   */
  setupSocket(socket) {
    if (!util.isSocket(socket)) {
      throw new Error('Expected a net.Socket instance but got: %s', socket);
    }
    const socketCandidate = socket;
    socketCandidate._buffer = '';
    socketCandidate.setEncoding('utf8');
    socketCandidate.setNoDelay(true);
    socketCandidate.setMaxListeners(Infinity);
    socketCandidate.once('connect', () => {
      this.emit('connect', socketCandidate);
    });
    socketCandidate.on('error', (error) => {
      debug('socket error', error);
      this.destroySocket(socketCandidate._id);
    });
    socketCandidate.on('close', (hadError) => {
      debug('socket closed, had error: %s', hadError);
      this.destroySocket(socketCandidate._id);
    });
    socketCandidate.on('data', (raw) => {
      const tokens = (socketCandidate._buffer + raw).split('\0');
      socketCandidate._buffer = tokens.pop();
      tokens.forEach(token => this.handleIncomingData(token, socketCandidate));
    });
    this._sockets[socketCandidate._id] = socketCandidate;
    return socketCandidate;
  }

  /**
   * Destroy socket
   * @param {string} id - Socket id
   * @return {(external:Socket|undefined)} - Socket with the passed id or undefined
   */
  destroySocket(id) {
    const socket = this._sockets[id];
    if (socket) {
      try {
        socket.removeAllListeners();
        socket.on('error', () => {});
        socket.destroy();
      } catch (error) {
        debug('error destroying socket', error);
      }
    }
    delete this._sockets[id];
    this.emit('disconnect', socket);
    return socket;
  }

  /**
   * Destroy all sockets
   * @return {JSONBottleInterface} - Self for chaining
   */
  destroyAllSockets() {
    Object
    .keys(this._sockets)
    .forEach(socketId => this.destroySocket(socketId));
    return this;
  }

  /**
   * Create message from input data.
   * Mainly intended for internal use, but can be used from outside
   * to inject message into the handling cycle.
   * @param {string|JSONBottleMessage~data} data     - Either raw JSON string or a message data object (if object, id can be passed as well)
   * @param {external:Socket}               [socket] - If present, represents the socket this message came from, otherwise the message returned will be treated as locally injected
   * @return {JSONBottleMessage} - New message object
   */
  handleIncomingData(data, socket) {
    const message = new JSONBottleMessage(data, this, socket);
    if (this._requests[message.id]) {
      this._requests[message.id](null, message);
    } else {
      this.handleIncomingMessage(message);
    }
    return message;
  }

  /**
   * Process message through the next registered handler
   * @param {JSONBottleMessage} message - Incoming message to process
   * @return {JSONBottleInterface} - Self for chaining
   */
  handleIncomingMessage(message) {
    if (message instanceof JSONBottleMessage === false || !message.isValid()) {
      debug('Cannot handle an invalid message: %s', message);
    } else {
      let index = 0;
      const next = () => {
        let handler = null;
        while (index < this._handlers.length && !handler) {
          handler = this._handlers[index++];
          if (handler
          && !(handler.tester && !handler.tester.test(message.path))) {
            if (handler.once) {
              this._handlers.splice(--index, 1);
            }
            try {
              handler.callback(message, next);
            } catch (error) {
              debug('Message handler error: %s %j', error, message);
              message.respond({ error: util.serializeError(error) });
            }
          } else {
            handler = null;
          }
        }
      };
      next();
    }
    return this;
  }

  /**
   * Send message
   * @param {JSONBottleMessage}                           message    - Message to send
   * @param {Array<external:Socket>}                      sockets    - Array of sockets to send the message to
   * @param {JSONBottleInterface~outgoingMessageCallback} [callback] - Outgoing message callback
   * @return {JSONBottleInterface} - Self for chaining
   */
  sendMessage(message, sockets, callback) {
    const cb = isFunction(callback) ? callback : undefined;
    if (!message || !message.isValid()) {
      debug('Cannot sendMessage, invalid message: %s', message);
      cb && cb(new Error('Invalid message.'));
    } else if (!isArray(sockets) || !sockets.length) {
      debug('Cannot sendMessage, invalid sockets provided: %s', sockets);
      cb && cb(new Error('Invalid sockets.'));
    } else {
      let sendError = null;
      sockets.forEach((socket) => {
        try {
          socket.write(`${JSON.stringify(message)}\0`);
        } catch (error) {
          debug('Error trying to send message to a socket: %s / %s',
          error, socket);
          sendError = error;
        }
      });
      cb && cb(sendError);
    }
    return this;
  }

  /**
   * Send message as a request (await response)
   * @param {JSONBottleMessage} message - Message that is issuing a request
   * @param {external:Socket}   socket  - Socket to send the request to
   * @param {number}            timeout - Response timeout in milliseconds
   * @return {Promise} - Promise representing the request
   */
  sendMessageRequest(message, socket, timeout) {
    return new Promise((resolve, reject) => {
      const request = this._requests[message.id] = (err, response) => {
        delete this._requests[message.id];
        clearTimeout(request._timeout);
        const error = err
        ? err
        : response.body && response.body.error
        ? (isString(response.body.error)
            ? new Error(response.body.error)
            : isObject(response.body.error)
            ? Object.assign(new Error(), response.body.error)
            : new Error())
        : null;
        if (error) {
          error.response = response;
        }
        return error
        ? reject(error)
        : resolve(response);
      };
      request._timeout = setTimeout(() => {
        request(new Error('Request timed out.'));
      }, timeout);
      this.sendMessage(message, [socket], error => error && request(error));
    });
  }

  /**
   * Create new message bound to this interface
   * @param {string} path - Message path
   * @param {Object} body - Message body
   * @return {JSONBottleMessage} - New message bound to this interface
   */
  createMessage(path, body) {
    return new JSONBottleMessage({ path, body }, this);
  }

  /**
   * Send body on path to all sockets
   * @param {JSONBottleMessage~data.path} path       - Send on specified path
   * @param {JSONBottleMessage~data.body} body       - Body to send
   * @param {(string|Array<string>)}      [socketId] - If provided, sends to socket id(s) specified, otherwise sends to all socket
   * @return {JSONBottleMessage} - Freshly sent message
   */
  send(path, body, socketId) {
    return new JSONBottleMessage({ path, body }, this).send(socketId);
  }

  /**
   * Issue request
   * @param {JSONBottleMessage~data.path} path       - Send on specified path
   * @param {JSONBottleMessage~data.body} body       - Body to send
   * @param {string}                      [socketId] - Id of the socket to issue the request to (request will be sent to the first found socket if not provided)
   * @param {number}                      [timeout]  - Response timeout in milliseconds, 10000 by default
   * @return {Promise} - Promise representing the request
   */
  request(path, body, socketId, timeout) {
    return new JSONBottleMessage({ path, body }, this)
    .sendAsRequest(socketId, timeout);
  }

  /**
   * Clears all pending requests by failing them
   * @param {Error} [error] - Error to reject pending requests with
   * @return {JSONBottleInterface} - Self for chaining
   */
  clearPendingRequests(error) {
    Object
    .values(this._requests)
    .forEach(request => request(
      error || new Error('Clearing pending requests.')
    ));
    return this;
  }

  /**
   * Use handler for incoming messages on specified path
   * @param {string}                                                path     - Path to handle messages for
   * @param {...JSONBottleInterface~incomingMessageHandlerCallback} callback - Message handler function
   * @return {JSONBottleInterface} - Self for chaining
   *//**
   * Use handler for all incoming messages
   * @param {...JSONBottleInterface~incomingMessageHandlerCallback} callback - Message handler function
   * @return {JSONBottleInterface} - Self for chaining
   */
  use(...args) {
    const tester = util.getPathTester(args[0]);
    args.forEach(callback => isFunction(callback) && this._handlers.push({
      once: false,
      tester,
      callback,
    }));
    return this;
  }

  /**
   * Use handler for incoming messages on specified path only once
   * @param {string}                                                path     - Path to handle messages for
   * @param {...JSONBottleInterface~incomingMessageHandlerCallback} callback - Message handler function
   * @return {JSONBottleInterface} - Self for chaining
   *//**
   * Use handler for any incoming message only once
   * @param {...JSONBottleInterface~incomingMessageHandlerCallback} callback - Message handler function
   * @return {JSONBottleInterface} - Self for chaining
   */
  useOnce(...args) {
    const tester = util.getPathTester(args[0]);
    args.forEach(callback => isFunction(callback) && this._handlers.push({
      once: true,
      tester,
      callback,
    }));
    return this;
  }
}

module.exports = JSONBottleInterface;
