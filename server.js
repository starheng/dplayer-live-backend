var WebSocket = new require('ws');

var argv = require('minimist')(process.argv.slice(2), {string: ['port'], default: {port: 1207}});

var server = new WebSocket.Server({
  clientTracking: true,
  port: argv['port']
}, function () {
  console.log('WebSocket server started on port: ' + argv['port']);
});

var shutdown = function () {
  console.log('Received kill signal, shutting down gracefully.');

  server.close(function () {
    console.log('Closed out remaining connections.');
    process.exit();
  });

  setTimeout(function () {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit();
  }, 10 * 1000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

server.on('error', function (err) {
  console.log(err);
});

var hexColorRegExp = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
var typeRegExp = /^(top|bottom|right)$/;
//// change these two variables to the following form, because the message format of dplayer has changed.  ////
var hexColorRegExp = /^\d{8}$/;
var typeRegExp = /^(0|1|2)$/;
var msgMinInterval = 500;
var lastMsgTimestamps = {};

server.on('connection', function (ws, req) {
  var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  ws.on('message', function (message) {
    var time = Date.now();
    if (lastMsgTimestamps[ip] && lastMsgTimestamps[ip] - time < msgMinInterval) {
      return;
    }
    try {
      message = JSON.parse(message);
      if (!hexColorRegExp.test(message.color) || !typeRegExp.test(message.type) || !message.text) {
        return;
      }
      var msg = {
        text: message.text.substr(0, 255),
        color: message.color,
        type: message.type
      };
    } catch (e) {
      return;
    }

    console.log(msg);
    lastMsgTimestamps[ip] = time;

    var data = JSON.stringify(msg);

    server.clients.forEach(function (client) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(data, function (err) {
          err && console.log(err);
        });
      }
    });
  });
  ws.on('error', console.log);
});

setInterval(function () {
  var time = Date.now();
  Object.keys(lastMsgTimestamps).forEach(function (key) {
    if (time - lastMsgTimestamps[key] > msgMinInterval) {
      delete lastMsgTimestamps[key];
    }
  });
}, 5000);
