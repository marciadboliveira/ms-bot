var nconf = require('nconf');
var request = require('request');
var restify = require('restify');
var builder = require('botbuilder');
var api = require('./api.js');
var fs = require('fs')

var config = nconf.env().argv().file({file: 'localConfig.json'});

//=========================================================
// Utility functions
//=========================================================

function _getEntity(entities, session){
    if (!entities.length && session){
        session.send('No entities found in your query!');
        throw Error();
    }
    // TODO: if multiple entities are present decide which one to use- for now the first one            
    var entityName = entities[0]; 
    return entityName;
}

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
        // TODO: Likely to expand, perhaps pull from API
        resolve([ "acquisitions", "investment", "partnerships", "none", "done" ]);
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
        if (message[0] == '/') {
            let parts = message.split(':');
            session.beginDialog(parts[0], parts.slice(1, parts.length));
        } else {
            askLUIS(message)
            .then((response) => {
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
                        session.beginDialog("/retrieveAlert", buildArgs(response.entities));
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
                    default :
                        session.send("Sorry... I didn't understand")
                        break;
                }
            });
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
                .then(json => {
                    session.send('Available alerts:\n' + JSON.stringify(json));
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
            companyName = args[0];
            next();
        },
        (session, args, next) => {
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
            companyName = _getEntity(args, session);
            next();
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
                        api.getAlert(selectedAlert.id)
                            .then(json => {
                                //session.send('Got alert for \"' + selectedAlert.title + '\":\n' + JSON.stringify(json));
                                session.say(json.data[0].skim.body, json.data[0].skim.body.split('\n')[0]);
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
                .then(json => {
                    session.send('Recent news for \"' + companyName + '\":\n' + JSON.stringify(json));
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
                        .title('Do you want to set an alert?')
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
            session.endDialogWithResult({response:results});
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

                    // Validate response
                    if (themes.indexOf(chosenTheme) != -1) {
                        chosenThemes.push(result.response);
                    }
                    else {
                        session.send("Please choose a valid theme or 'Done' when finished");
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

    bot.dialog('/help', (session, args, next) => {
        loadHelp().then((result) => {
            session.send(result);
            session.endDialog();
        })
    });
}

main();
