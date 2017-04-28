var api = require('./api.js');
var crypto = require('crypto');

var _alerts = {};
var _callback = null;

function proactiveMessage(bot, toAddress, msg) {
    // Send a message at any time
    var message = new builder.Message().address(toAddress).text(msg);
    bot.send(message);
}

function _poll() {
  for (var user in _alerts) {
    for (var id in _alerts[user]) {
      api.getAlert(id, _alerts[user][id].themes, parseInt(_alerts[user][id].lastRead))
      .then((skims) => {
        if (skims.error) {
          return;
        }
        if (skims && skims.data.length > 0) {
          _callback(_alerts[user][id].toAddress, skims);
          _alerts[user][id].lastRead = new Date().getTime() / 1000;
        }
      });
    }
  }
}

function addAlert(user, address, id, title, themes, freq) {

  if (!_alerts[user]) {
    _alerts[user] = {};
  }
  
  var userAlerts = _alerts[user];
  if (!userAlerts[id]) {
    userAlerts[id] = { title: title, themes : themes, freq : freq, lastRead: 0, toAddress: address }; 
  }
}

function deleteAlert(user, id) {
  try {
    delete _alerts[user][id];
  }
  catch (e) {
  }
}

let POLLING_FREQUENCY = 10000;

function beginAlerting(cb) {

  _callback = cb;
  
  // TODO: Load alerts from persitent storage

  setInterval(() => {
    _poll();
  }, POLLING_FREQUENCY);
}

module.exports = {
  "addAlert" : addAlert,
  "deleteAlert" : deleteAlert,
  "beginAlerting" : beginAlerting
}