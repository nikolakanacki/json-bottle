/* global jest, test, expect */

const JSONBottle = require('./index');

const PORT = 8008;
const HOST = 'localhost';

const server = new JSONBottle.Server();
const client1 = new JSONBottle.Client();
const client2 = new JSONBottle.Client();

test('Starting the server', (done) => {
  server.once('started', done);
  server.start(PORT, HOST);
});

test('Starting the client no. 1', (done) => {
  server.once('connect', done);
  client1.start(PORT, HOST);
});

test('Server should have 1 client now', (done) => {
  expect(server.getSockets().length).toBe(1);
  done();
});

test('Starting the client no. 2', (done) => {
  server.once('connect', done);
  client2.start(PORT, HOST);
});

test('Server should have 2 clients now', (done) => {
  expect(server.getSockets().length).toBe(2);
  done();
});

test('Sending message from client no. 1', (done) => {
  const path = JSONBottle.util.generateId();
  server.use(path, (message) => {
    if (message.body.data === path) {
      done();
    }
  });
  client1.send(path, { data: path });
});

test('Sending message from server', (done) => {
  const path = JSONBottle.util.generateId();
  const pass = jest.fn(() => pass.mock.calls.length === 2 && done());
  client1.use(path, (message) => {
    message.body.data === path && pass();
  });
  client2.use(path, (message) => {
    message.body.data === path && pass();
  });
  server.send(path, { data: path });
});

test('Chaining handlers using the "next" callback', (done) => {
  const path = JSONBottle.util.generateId();
  server
  .use(path, (message, next) => {
    message.data.path = path;
    next();
  })
  .use(path, (message) => {
    expect(message.data.path).toBe(path);
    done();
  });
  client1.send(path, {});
});

test('Making a client > server request', (done) => {
  const path = JSONBottle.util.generateId();
  const pass = jest.fn(() => pass.mock.calls.length === 4 && done());
  let resNum = 0;
  server.use(path, (message) => {
    message.respond({ data: message.body.data + (++resNum) });
    pass();
  });
  client1.request(path, { data: path }).then((message) => {
    expect(message.body.data).toBe(path + 1);
    pass();
  });
  client2.request(path, { data: path }).then((message) => {
    expect(message.body.data).toBe(path + 2);
    pass();
  });
});

test('Making a server > client request', (done) => {
  const path = JSONBottle.util.generateId();
  const helo = JSONBottle.util.generateId();
  server.use(helo, (heloMessage) => {
    server.request(path, { data: path }, heloMessage.origin).then((message) => {
      expect(message.body.data).toBe(path);
      done();
    });
  });
  client1.use(path, (message) => {
    message.respond({ data: message.body.data });
  });
  client1.send(helo, { data: path });
});

test('Testing the request timeout (custom, 2 seconds)', (done) => {
  const path = JSONBottle.util.generateId();
  client1.request(path, {}, 2000).catch((error) => {
    expect(error.message).toBe('Request timed out.');
    done();
  });
});

test('Testing handler used only once', (done) => {
  const path = JSONBottle.util.generateId();
  const pass = jest.fn(() => pass.mock.calls.length === 2 && done());
  server.useOnce(path, (message) => {
    expect(message.body.data).toBe(path);
    pass();
  });
  client1.request(path, { data: path }).then(pass);
  client1.request(path, { data: path }, 2000).catch((error) => {
    expect(error.message).toBe('Request timed out.');
    pass();
  });
});

test('Testing a custom request response error', (done) => {
  const path = JSONBottle.util.generateId();
  const pass = jest.fn(() => pass.mock.calls.length === 2 && done());
  let resNum = 0;
  client2.request(path).catch((error) => {
    expect(error.message).toBe('Custom error 1.');
    pass();
  });
  client2.request(path).catch((error) => {
    expect(error.message).toBe('Custom error 2.');
    pass();
  });
  server.use(path, (message) => {
    resNum++;
    if (resNum === 1) {
      throw new Error('Custom error 1.');
    } else if (resNum === 2) {
      message.respond({ error: 'Custom error 2.' });
    }
  });
});

test('Auto-reconnect client', (done) => {
  const pass = jest.fn(() => pass.mock.calls.length === 3 && done());
  client1.once('connect', pass);
  server.once('started', pass);
  server.once('connect', pass);
  server.start(PORT, HOST);
});
