const debug = require('debug')('json-bottle:message');
const util = require('./util');

const isArray = require('lodash/isArray');
const isObject = require('lodash/isObject');
const isString = require('lodash/isString');
const isNumber = require('lodash/isFinite');
const isFunction = require('lodash/isFunction');

/**
 * Message data
 *
 * @typedef {Object} JSONBottleMessage~data
 *
 * @property {string} id   - Message unique id (will be generated if not passed)
 * @property {string} path - Message path
 * @property {Object} body - Message body, defaults to an empty object
 */

/**
 * JSONBottleMessage
 * @class
 */
class JSONBottleMessage {

  /**
   * Check if valid id
   * @param {mixed} id - Id to check
   * @return {boolean} - True if valid, false otherwise
   */
  static isValidId(id) {
    return isString(id) && id.length > 0;
  }

  /**
   * Check if valid subject
   * @param {mixed} path - Path to check
   * @return {boolean} - True if valid, false otherwise
   */
  static isValidPath(path) {
    return isString(path) && path.length > 0;
  }

  /**
   * Constructor
   * @param {string|JSONBottleMessage~data} data     - Message data
   * @param {JSONBottleInterface}           owner    - JSONBottleInterface that created the message
   * @param {external:Socket}               [origin] - If passed, represents the socket that the message came from (and can be replied to), otherwise message is treated as local
   */
  constructor(data, owner, origin) {
    try {
      const { id, path, body } = typeof data === 'string'
      ? JSON.parse(data)
      : data;
      this.id = id;
      this.path = path;
      this.data = {};
      this.body = body || {};
      this._owner = owner;
      this._origin = origin;
      this._replied = false;
    } catch (error) {
      debug('Error parsing message: %s / %s', error, data);
    }
  }

  /**
   * Message id
   * @type {string}
   */
  get id() {
    return this._id;
  }
  set id(v) {
    this._id = typeof this._id !== 'undefined'
    ? this._id
    : JSONBottleMessage.isValidId(v)
    ? v
    : util.generateId();
    return this._id;
  }

  /**
   * Message path
   * @type {(string|undefined)}
   */
  get path() {
    return this._path;
  }
  set path(v) {
    this._path = typeof this._path !== 'undefined'
    ? this._path
    : JSONBottleMessage.isValidPath(v)
    ? v
    : undefined;
    return this._id;
  }

  /**
   * Message body
   * @type {(object|undefined)}
   */
  get body() {
    return this._body;
  }
  set body(v) {
    this._body = isObject(v)
    ? v
    : this._body;
    return this._body;
  }

  /**
   * Message origin (if message is not local)
   * @type {(string|undefined)}
   */
  get origin() {
    return this._origin
    ? this._origin._id
    : undefined;
  }

  /**
   * Send the message
   * @param {(string|Array<string>)}                      [destination] - If provided, sends to socket id(s) specified, otherwise sends to all socket
   * @param {JSONBottleInterface~outgoingMessageCallback} [callback]    - Outgoing message callback
   * @return {JSONBottleMessage} - Self for chaining
   */
  send(destination, callback) {
    if (!this.isValid()) {
      debug('Cannot send invalid message: %j', this);
    } else {
      const cb = isFunction(destination)
      ? destination
      : isFunction(callback)
      ? callback
      : undefined;
      const sockets = isString(destination)
      ? [this._owner.getSocket(destination)]
      : isArray(destination)
      ? this._owner.getSockets()
        .filter(socket => destination.indexOf(socket._id) > -1)
      : this._owner.getSockets();
      this._owner.sendMessage(this, sockets, cb);
    }
    return this;
  }

  /**
   * Send the message as a request
   * @param {string} [destination]   - Socket id to send the request to. If not present will send to the first socket found on this interface
   * @param {number} [timeout=10000] - Request timeout in milliseconds
   * @return {Promise} - Promise representing the request
   */
  sendAsRequest(destination, timeout) {
    if (!this.isValid()) {
      debug('Cannot send invalid message as a request: %j', this);
      return Promise.reject(
        new Error('Cannot send invalid message as a request.')
      );
    }
    const requestTimeout = util
    .override(isNumber, destination, timeout, this._owner.getConfig('timeout'));
    const sockets = this._owner
    .getSocket(destination) || this._owner.getSockets()[0];
    return this._owner.sendMessageRequest(this, sockets, requestTimeout);
  }

  /**
   * Respond to the message
   * @param {Object} [body={}] - Body to send with a response
   * @return {JSONBottleMessage} - Self, for chaining
   */
  respond(body = {}) {
    if (this.isReplied()) {
      debug('Tried to respond to an already replied message: %s', this);
    } else if (!this.isValid()) {
      debug('Tried to respond to an invalid message: %s', this);
    } else if (this.isLocal()) {
      debug('Tried to respond to a local message: %s', this);
    } else {
      try {
        this.copy({ body }).send(this._origin._id);
      } catch (error) {
        debug('Error trying to respond to message: %s', this);
      }
      this._replied = true;
    }
  }

  /**
   * Check if message is local (self injected)
   * @return {boolean} - True if local, false otherwise
   */
  isLocal() {
    return !this._origin;
  }

  /**
   * Check if message was already replied to
   * @return {boolean} - True if replied, false otherwise
   */
  isReplied() {
    return this._replied;
  }

  /**
   * Prepopulate new message with data from the current one
   * @param {JSONBottleMessage~data} [data] - Data to override props from the current message
   * @return {JSONBottleMessage} - New message
   */
  copy(data) {
    return new JSONBottleMessage(
      Object.assign(this.toJSON(), data), this._owner
    );
  }

  /**
   * Check if message is valid
   * @return {boolean} - True if (assumed) valid, false otherwise
   */
  isValid() {
    return this._id && this._path && this._body && this._owner;
  }

  /**
   * Return message data object ready to be stringified
   * @return {JSONBottleMessage~data} - Message data object
   */
  toJSON() {
    return {
      id: this._id,
      path: this._path,
      body: this._body,
    };
  }

  /**
   * Get string representation of this message
   * @return {string} - String representation of the message
   */
  toString() {
    return `JSONBottleMessage[${this.id}:${this.path}]`;
  }

}

module.exports = JSONBottleMessage;
