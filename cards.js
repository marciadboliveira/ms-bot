var url = require('url');
var guid = require("guid");
var builder = require('botbuilder');

function createSkimCard(skim, session) {
    let card = new builder.HeroCard(session)
        .title(skim.title)
        .text(skim.body);

    // Cache the skim body so we can read it to the user later
    var uuid = guid.raw();
    if (!('skims' in session.privateConversationData)) {
        session.privateConversationData.skims = {};
    }
    // TODO: We should limit the size of this cache
    session.privateConversationData.skims[uuid] = skim.body;

    if (skim.uri != undefined) {
        // TODO: why some skims don't have an URL? Are they from recent news only?
        var buttons = [];
        buttons.push(builder.CardAction.openUrl(session, skim.uri, 'Open in browser'));
        if (session.source == 'cortana') {
            buttons.push(builder.CardAction.postBack(session, `/readSkim:${uuid}`, 'Read this'));
        }
        card.buttons(buttons);
    }

    if (skim.images.length > 0) {
        var uri = url.parse(skim.images[0]);
        uri.protocol = 'http:'; // Bot SDK seems to have trouble rendering https links 

        card.images([
            builder.CardImage.create(session, uri.format())
        ]);
    }

    return card;
}

function sendSkimsCards(skims, session) {

    // Clear the skim cache
    session.privateConversationData.skims = {};

    let message = new builder.Message(session);
    let skimCards = skims.map(skim => createSkimCard(skim, session));

    message.attachmentLayout(builder.AttachmentLayout.carousel)
    message.attachments(skimCards);
    session.send(message);
}


module.exports = {
    'createSkimCard': createSkimCard,
    'sendSkimsCards': sendSkimsCards
}
