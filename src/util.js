const uuid = require('uuid');
const net = require('net');

const isError = require('lodash/isError');
const isObject = require('lodash/isObject');
const isString = require('lodash/isString');
const isRegExp = require('lodash/isRegExp');
const isFunction = require('lodash/isFunction');

/**
 * Generate UUIDv4
 * @return {string} - Freshly generate UUIDv4
 * @private
 */
module.exports.generateId = function generateId() {
  return uuid.v4();
};

/**
 * Serialize error to object, or return a default object with message
 * @param {Error} error - Error to serialize
 * @return {Object} - Serialized error object
 * @private
 */
module.exports.serializeError = function serializeError(error) {
  return isObject(error) || isError(error) || error instanceof Error
  ? Object.getOwnPropertyNames(error).reduce((obj, key) => {
    obj[key] = error[key];
    return obj;
  }, {})
  : { message: 'Internal error.' };
};

/**
 * Get RegExp object that tests positively for the matching paths
 * @param {(string|RegExp)} path - Path to make the tester for (if RegExp is passed, it will be used instead)
 * @return {RegExp} - Path RegExp tester
 * @private
 */
module.exports.getPathTester = function getPathTester(path) {
  return isString(path)
  ? new RegExp([
    '^',
    path
    .replace(/[-[\]{}()+?.,\\^$|#\s]/g, '\\$&')
    .replace(/\*{2,}/g, '.*')
    .replace(/\*/g, '[^:]+'),
    '$',
  ].join(''))
  : isRegExp(path)
  ? path
  : null;
};

/**
 * Get the first value that matches the type
 * @param {(function|string)} - Either a testing function or a string representing a plain javascript type
 * @return {mixed} - The first value matching the type
 * @private
 */
module.exports.override = function override(type, ...values) {
  // eslint-disable-next-line valid-typeof
  const test = isFunction(type) ? type : value => typeof value === type;
  return values.find(value => test(value));
};

/**
 * Test if value is a net.Socket instance
 * @param {mixed} value - Value to test
 * @return {boolean} - True if value is net.Socket instance, false otherwise
 * @private
 */
module.exports.isSocket = function isSocket(value) {
  return value instanceof net.Socket;
};
