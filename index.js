var Bot = require('slackbots');
var fs = require('fs');
var schedule = require('node-schedule')
var config = JSON.parse(fs.readFileSync('config.json'));
var zomato = require('./zomato.js');
var custom = require('./custom.js');
var ordr = require('./ordr.js');

var providers = [zomato, ordr];

var settings = {
  token: config.token,
  name: config.name,
};
var bot = new Bot(settings);

Array.prototype.randomElement = function(callback) {
  callback(this[Math.floor(Math.random() * this.length)])
}

function formatLine(line) {
  return line.replace(/(\r\n|\n|\r)/gm, "").trim() + "\r\n\r\n";
}

function formatResponse(data, title) {

  var res = "\r\n\r\n*" + title + "*\r\n\r\n";

  if (data.length == 0) {
    return res + formatLine("data not available");
  }

  for (var i = 0; i < data.length; ++i) {
    res = res + formatLine(data[i]);
  }
  return res;
}

function sendResponse(id, data, title) {
  bot.postMessage(id, formatResponse(data, title))
}

function processMessage(msg, id) {
  console.log('received: ' + msg);

  switch (msg) {
    case "help":
      var restaurants = "";
      for (var i = 0; i < providers.length; ++i) {
        var res = providers[i].restaurants();
        for (var j = 0; j < res.length; ++j) {
          restaurants = restaurants + " *" + res[j] + "*,";
        }
      }

      bot.postMessage(id, "I know" + restaurants.substring(0, restaurants.length - 1) + ".");
      break;
    case "about":
      bot.postMessage(id, "Lunchbuddy bot by *Igor Kulman*");
      break;

    case "all":
      providers.forEach(function(provider) {
        provider.restaurants().forEach(function(restaurant) {
          var msg = restaurant
          provider.get(msg, function(data) {
            sendResponse(id, data, provider.name(msg));
          });
        });
      });
      break;
    default:

      for (var i = 0; i < providers.length; ++i) {
        if (providers[i].handles(msg)) {
          providers[i].get(msg, function(data) {
            sendResponse(id, data, providers[i].name(msg));
          });
          return;
        }
      }

      bot.postMessage(id, "Sorry, I do not know " + msg + ". Use *help* to see what I know.");
      break;
  }
}

function getProviderForKeyword(keyword, callback) {
  for (var i = 0; i < providers.length; ++i)  {
    if (providers[i].handles(keyword)) {
      callback(providers[i]);
    }
  }
}

bot.on('start', function() {
  console.log("bot started");
  schedule.scheduleJob('0 0 11 *  * 1-5', function() {
  // schedule.scheduleJob('*/10 * * *  * 1-5', function() {
    var restaurants = []
    for (var i = 0; i < providers.length; ++i) {
      restaurants = restaurants.concat(providers[i].restaurants())
    }
    restaurants.randomElement(function(restaurant) {
      getProviderForKeyword(restaurant, function(provider) {
        provider.get(restaurant, function(data) {
          bot.postMessageToChannel('obed',
          // bot.postMessageToUser('daniel.rutkovsky',
            "Hi, it's *lunch time*. Why don't you try something new today. Look at:" + formatResponse(data, provider.name(restaurant)))
        });
      });
    });
  });
});

bot.on('message', function(data) {
  // all ingoing events https://api.slack.com/rtm
  if (data.type == "message" && data.text.startsWith('<@' + bot.self.id + '>:')) {
    var msg = data.text.replace('<@' + bot.self.id + '>: ', '');
    processMessage(msg, data.channel);
  }

  if (data.type == "message" && data.channel.startsWith('D') && !data.bot_id) {
    processMessage(data.text, data.channel);
  }

});
