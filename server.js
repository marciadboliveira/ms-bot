var fs = require('fs')
var moment = require('moment')
var nconf = require('nconf');
var request = require('request');
var restify = require('restify');
var builder = require('botbuilder');
var api = require('./api.js');
var cards = require('./cards.js')

var config = nconf.env().argv().file({file: 'localConfig.json'});

//=========================================================
// Utility functions
//=========================================================

function buildArgs(entities) {
    return entities.map(o => o.entity)
}

function _askLUIS(appId, subKey, q) {
    var uri = `https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/${appId}?subscription-key=${subKey}&verbose=true&q=${q}`;

    return new Promise((resolve, reject) => {
        var options = {
            uri: uri,
            method: 'GET'
        };
        request(options, (err, response, body) => {
            resolve(JSON.parse(body));
        })
    })
}

function askLUIS(q) {
    return _askLUIS(config.get("LUIS_APP_ID"), config.get("LUIS_SUBSCRIPTION_KEY"), q);
}

function getThemes() {
    return new Promise((resolve, reject) => {
        // TODO: Likely to expand, perhaps pull from API; then add general list actions
        resolve(["acquisitions", "investments", "partnerships"].concat("at least one", "no theme", "done"));
    });
}

function titleCase(str) {
    return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}

function createThemeCard(session, themes) {

    var card = new builder.HeroCard(session)
    .title('BotFramework Hero Card')
    .subtitle('Your bots — wherever your users are talking')
    .text('Choose a theme')
    .images([
        builder.CardImage.create(session, 'https://sec.ch9.ms/ch9/7ff5/e07cfef0-aa3b-40bb-9baa-7c9ef8ff7ff5/buildreactionbotframework_960.jpg')
    ]);

    var buttons = [];
    buttons = themes.map((e) => {
        return new builder.CardAction.imBack(session, e, titleCase(e));
    });
    card.buttons(buttons);

    return card;
}

function loadHelp() {
    return new Promise((resolve, reject) => {
        fs.readFile('help.md', 'utf-8', (err, data) => {
            if (err) reject(err);
            resolve(data)
        })
    })
}

function handleIntent(session, msg, defaultResponse, cancelPrevious) {
    askLUIS(msg)
    .then((response) => {
        if (response.topScoringIntent.intent != 'None') {
            if (cancelPrevious) {
                session.cancelDialog(0);
            }
        }
        switch (response.topScoringIntent.intent) {
            case 'listAlerts':
                session.beginDialog("/listAlerts");
                break;
            case 'createAlert':
                session.beginDialog("/createAlert", buildArgs(response.entities));
                break;
            case 'deleteAlert':
                session.beginDialog("/deleteAlert", buildArgs(response.entities));
                break;
            case 'retrieveAlert':
                var retrieveParams = {
                    entities: buildArgs(response.entities),
                    query: response.query
                }
                session.beginDialog("/retrieveAlert", retrieveParams);
                break;
            case 'getRecentNews':
                session.beginDialog("/getRecentNews", buildArgs(response.entities));
                break;
            case 'end':
                session.beginDialog('/end');
                break;
            case 'help':
                session.beginDialog('/help');
                break;
            case 'None':
            default:
                session.send(defaultResponse);
                break;
        }
    });
}

function proactiveMessage(bot, toAddress, msg) {
    // Send a message at any time
    var message = new builder.Message().address(toAddress).text(msg);
    bot.send(message);
}

function proactiveDialog(bot, toAddress, msg) {
    // Start a dialog at any time - Be aware, you might interrupt an existing conversation
   var message = new builder.Message().address(toAddress).text(msg);
   bot.send(message);
}


//=========================================================
// Bot Setup
//=========================================================

function main() {

    // Setup Restify Server
    var server = restify.createServer();
    server.listen(process.env.port || process.env.PORT || 3978, '0.0.0.0', function () {
      console.log('%s listening to %s', server.name, server.url); 
    });
      
    // Create chat bot
    var connector = new builder.ChatConnector({
      appId: config.get('MICROSOFT_APP_ID'),
      appPassword: config.get('MICROSOFT_APP_PASSWORD')
    });

    //var connector = new builder.ConsoleConnector().listen()
    var bot = new builder.UniversalBot(connector);
    server.post('/api/messages', connector.listen());

    //=========================================================
    // Bots Dialogs
    //=========================================================

    bot.dialog('/', function (session) {
        let message = session.message.text;
        if (!message || message.length == 0) {
            session.send("Waiting for your command");
            session.endDialog();
            return;
        }
        if (message[0] == '/') {
            let parts = message.split(':');
            session.beginDialog(parts[0], parts.slice(1, parts.length));
        } else {
            handleIntent(session, message, "I'm sorry I didn't understand that");
        }
    });

    bot.dialog('/end', [
        (session) => {
            session.send('Do you need anything else?');
            session.endDialog();
        }
    ]);

    var companyName;

    bot.dialog('/listAlerts', [
        (session, args, next) => {
            api.listAlerts()
                .then(alerts => {
                    let titles = alerts.map(alert => alert.title);                    
                    let text = 'Here are the alerts you have:\n';
                    for (let i = 0; i < titles.length; i++) {
                        text += (i+1) + '. ' + titles[i] + '\n';
                    }
                    session.send(text);
                    next();
                })
                .catch(err => {
                    session.send('Failed to list alerts');
                    next();
                });
        },
        (session, results) => {
            session.endDialog();
        }

    ]);

    bot.dialog('/createAlert', [
        (session, args, next) => {
            if (!args.length) { // no entity mentioned
                builder.Prompts.text(session, 'Which company are you interested in?');
                 //will call next when user types something in
            } else { 
                next({ response: args[0] });  //make compatible with what Prompts returns
            }
        },
        (session, args, next) => {
            companyName = args.response;
            session.beginDialog('/getThemes');
        },
        (session, args, next) => {

            // Persist the themes for this alert
            if (!session.privateConversationData.alerts) {
                session.privateConversationData.alerts = {};
            }
            session.privateConversationData.alerts[companyName] = {};
            session.privateConversationData.alerts[companyName].themes = args.response;

            api.createAlert(companyName, [companyName])
                .then(json => {
                    session.send('Created alert for \"' + json.title + '\"');
                    next();
                })
                .catch(err => {
                    session.send('Failed to create alert for \"' + companyName + '\"');
                    next();
                })
        },
        (session, results) => {
            session.endDialog();
        }
    ]);

    bot.dialog('/deleteAlert', [
        (session, args, next) => {
            companyName = args[0];
            next();
        },
        (session, args, next) => {
            api.listAlerts().then(
                (alerts) => {
                    var selectedAlert = alerts.find((alert) => {
                       return alert.title === companyName
                    });

                    if (selectedAlert === undefined) {
                        session.send('There is no alert set up for \"' + companyName + '\"');
                        next();
                    } else { 
                        api.deleteAlert(selectedAlert.id)
                            .then(json => {
                                delete session.privateConversationData.alerts[companyName];
                                session.send('Deleted alert for \"' + selectedAlert.title + '\"');
                                next();
                            })
                            .catch(err => {
                                session.send('Failed to delete alert for \"' + companyName + '\"');
                                next();
                            })
                    }
                }
            );
        },
        (session, results) => {
            session.endDialog();
        }
    ]);

    bot.dialog('/retrieveAlert', [
        (session, args, next) => {
            companyName = args.entities[0];
            next(args);
        },
        (session, args, next) => {
            api.getTimeExpressions(args.query).then((times) => {
                if (times.length > 0){
                    // TODO work out how to deal with multiple times
                    since = moment(times[0].resolved).unix();
                    console.log('json', times[0].resolved);
                    console.log('parsed', moment(times[0].resolved));
                    console.log('parsed unix', since);
                }
                next(args);
            });  
        },
        (session, args, next) => {
            api.listAlerts().then(
                (alerts) => {
                    var selectedAlert = alerts.find((alert) => {
                       return alert.title === companyName
                    });

                    if (selectedAlert === undefined) {
                        session.send('Could not find alerts for \"' + companyName + '\". Retrieving recent news instead:')
                        session.beginDialog('/getRecentNews', [companyName]);
                    } else {
                        var themes = [];
                        // TODO: Wrap up persistent store handling
                        if (session.privateConversationData.alerts) {
                            if (companyName in session.privateConversationData.alerts) {
                                themes = session.privateConversationData.alerts[companyName].themes;
                            }
                        }
                        api.getAlert(selectedAlert.id, themes, since)
                            .then(json => {
                                if (json.data.length > 0) {
                                    // session.say(json.data[0].skim.body, json.data[0].skim.body.split('\n')[0]);
                                    let data = json.data.slice(0, 3);
                                    let skims = data.map(d => d.skim);
                                    cards.sendSkimsCards(skims, session);
                                }
                                else {
                                    session.say(
                                        `No new updates for ${companyName} (topics: ${themes})`, 
                                        `No new updates for ${companyName}`
                                    );
                                }
                                next();
                            })
                            .catch(err => {
                                session.send('Failed to get alert for \"' + companyName + '\"');
                                next();
                            })
                    }
                }
           ).catch(err => {
               session.beginDialog('/getRecentNews', [companyName]);
           });
        },
        (session, results) => {
            session.endDialog();
        }
    ]);

    bot.dialog('/getRecentNews', [
        (session, args, next) => {
            companyName = args[0];
            next();
        },
        (session, args, next) => {
            api.getRecentNews(companyName, 3)
                .then(skims => {
                    session.send('Here are the recent news for \"' + companyName + '\":');
                    cards.sendSkimsCards(skims, session);
                    next();
                })
               .catch(err => {
                    session.send('Failed to get recent news for \"' + companyName + '\"');
                    session.endDialog();
               });
        },
        (session, results) => {
            var msg = new builder.Message(session)
                .textFormat(builder.TextFormat.xml)
                .attachments([
                    new builder.ThumbnailCard(session)
                        .title('Do you want to set an alert for \"' + companyName + '\"?')
                        .buttons([
                            builder.CardAction.postBack(session, '/createAlert:' + companyName , 'Yes'),
                            builder.CardAction.postBack(session, '/end', 'No')
                        ]),
                ]);
            session.endDialog(msg);
        }
    ]);

    bot.dialog('/getThemes', [
        (session, args, next) => {
            getThemes()
            .then((themes) => {
                session.beginDialog('/getTheme', themes);
            });
        },
        (session, results) => {
            session.endDialogWithResult(results);
        }
    ]);

    bot.dialog('/getTheme', [
        (session, themes, next) => {
            var card = createThemeCard(session, themes);
            var msg = new builder.Message(session).addAttachment(card);
            builder.Prompts.text(session, msg);
        },
        (session, result) => {
            // User has provided a response
            var chosenTheme = result.response;

            // Pull previous choices from persistent storage
            var chosenThemes = session.privateConversationData.chosenThemes;
            if (!chosenThemes) {
                chosenThemes = [];
            }

            if (chosenTheme == 'done') {
                // Selection complete
                session.privateConversationData.chosenThemes = null;
                session.endDialogWithResult({response:chosenThemes})
            }
            else {

                getThemes()
                .then(themes => {

                    if (chosenTheme == 'no theme') {
                        chosenThemes = [];
                    } else if (chosenTheme == 'at least one') {
                        chosenThemes = themes.slice(0, -3);
                    } else {
                        // Validate response
                        if (themes.indexOf(chosenTheme) != -1) {
                            chosenThemes.push(result.response);
                        }
                        else {
                            // If not a valid response, see if it's a top-level intent,
                            // if cancelPrevious (final parm) == false then top level intent is handled as a subdialog
                            // of the current one, if true then dialog stack is blown away
                            handleIntent(session, chosenTheme, "Please choose a valid theme or 'Done' when finished", true);
                            return;
                        }
                    }

                    // Filter out already chosen themes
                    var remainingThemes = themes.filter((e) => {
                        return (chosenThemes.indexOf(e) == -1);
                    });
                    
                    session.privateConversationData.chosenThemes = chosenThemes;
                    session.replaceDialog("/getTheme", remainingThemes)
                });
            }
        }
    ]);

    bot.dialog('/getFrequency', [
        (session, args, next) => {
            let message = new builder.Message(session)
                .textFormat(builder.TextFormat.xml)
                .attachments([
                    new builder.ThumbnailCard(session)
                        .title('What is the frequency you want to set the alert?')
                        .buttons([
                            builder.CardAction.imBack(session, 'Daily', 'Daily'),
                            builder.CardAction.imBack(session, 'Weekly', 'Weekly'),
                            builder.CardAction.imBack(session, 'ASAP', 'ASAP')
                        ])
                ]);
            builder.Prompts.text(session, message);
        },
        (session, result) => {
            let frequency = result.response;
            session.endDialogWithResult({response: frequency});
        }
    ]);

    bot.dialog('/help', (session, args, next) => {
        loadHelp().then((result) => {
            session.send(result);
            session.endDialog();
        })
    });

    bot.dialog('/readSkim', [
        // Have Cortana read out the skim body
        (session, args, next) => {
            var uuid = args[0];
            if ('skims' in session.privateConversationData && 
                uuid in session.privateConversationData.skims) {
                var body = session.privateConversationData.skims[uuid];
                session.say(body, body);
            }
            else {
                session.say('Sorry, can\'t find that skim');
            }
            session.endDialog();
        }
    ]);

    bot.dialog('/proactiveAlert', [
        (session, args, next) => {
            session.send("I'm going to send you a message in 5 seconds")

            // TODO: In real life we'd add the address, message etc to 
            // persistent storage and have some more sophisticated mechanism
            // to ensure things survive reboots/redeploys etc

            // The thing to not about proactive messaging is that you can't rely
            // on the session being valid accross reboots etc so instead we save the return
            // address and use that directly

            setTimeout(() => {
                proactiveMessage(bot, session.message.address, "I'm a proactive message");
            }, 5000);

            session.endDialog();
        }
    ]);
}

main();
