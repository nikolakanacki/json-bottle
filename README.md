# JSONBottle

[![Build Status](https://travis-ci.org/nikolakanacki/json-bottle.svg?branch=master)](https://travis-ci.org/nikolakanacki/json-bottle)
![Current version badge](https://img.shields.io/badge/version-1.0.0-brightgreen.svg)

Socket based JSON messaging system written for NodeJS.

Checkout the [API docs](https://nikolakanacki.github.io/json-bottle/) for full reference, and the code at [nikolakanacki/json-bottle](https://github.com/nikolakanacki/json-bottle/) for implementation details.

## Features

- Simple API
- Utilizing ES6 classes
- Auto-reconnect clients
- Implements both fire-and-forget and request-response concepts
- Middleware system similar to [Express](https://expressjs.com/)
- Easily extendable
- Fast

## Install

Using [yarn](https://yarnpkg.com/en/):
```
yarn add nikolakanacki/json-bottle
```

Using [npm](https://www.npmjs.com/):
```
npm install --save nikolakanacki/json-bottle
```

## Run tests

```
npm test
```

## Usage examples

Checkout the docs for the main components (classes):
- [`JSONBottleServer`](https://nikolakanacki.github.io/json-bottle/JSONBottleServer.html)
- [`JSONBottleClient`](https://nikolakanacki.github.io/json-bottle/JSONBottleClient.html)
- [`JSONBottleInterface`](https://nikolakanacki.github.io/json-bottle/JSONBottleInterface.html)
- [`JSONBottleMessage`](https://nikolakanacki.github.io/json-bottle/JSONBottleMessage.html)

### Server

```javascript
const HOST = 'localhost';
const PORT = 8008;

const JSONBottle = require('json-bottle');
const server = new JSONBottle.Server();

server.on('connect', (socket) => {
  console.log(socket._id);
  // > Socket id (UUIDv4)
});
server.use('some-request-path', (message, next) => {
  console.log(message.body);
  // > { some: "Request data" }
  message.respond({ some: "Response data" });
});
server.use('some-message-path', (message, next) => {
  console.log(message.body);
  // > { some: "Message data" }
});
server.start(PORT, HOST);
```

### Client

```javascript
const HOST = 'localhost';
const PORT = 8008;

const JSONBottle = require('json-bottle');
const client = new JSONBottle.Client();

client.once('started', () => {
  client
  .request('some-request-path', { some: "Request data" })
  .then((message) => {
    console.log(message.body);
    // > { some: "Response data" }
  });
  client.send('some-message-path', { some: 'Message body' });
});
client.start(PORT, HOST);
```

### Interface

You can use the `JSONBottleInterface` class to implement your own client
and server provider. The main method to look at is `JSONBottleInterface.setupSocket`.
For more info checkout the [API docs](https://nikolakanacki.github.io/json-bottle/) and the code.

## Roadmap
- Write examples
- Make TLSServer and TLSClient classes with boilerplate

## License

MIT License

Copyright (c) 2017 Nikola Kanački

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
