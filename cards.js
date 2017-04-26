var url = require('url');
var builder = require('botbuilder');

function createSkimCard(skim, session) {
    let card = new builder.HeroCard(session)
        .title(skim.title)
        .text(skim.body);
    
    if (skim.uri != undefined) {
        // TODO: why some skims don't have an URL? Are they from recent news only?

       card.buttons([
            builder.CardAction.openUrl(session, skim.uri, 'Open in browser')
        ]); 
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
    let message = new builder.Message(session);
    let skimCards = skims.map(skim => createSkimCard(skim, session));

    // message.attachmentLayout(builder.AttachmentLayout.carousel)
    message.attachments(skimCards);
    session.send(message);
}


module.exports = {
    'createSkimCard': createSkimCard,
    'sendSkimsCards': sendSkimsCards
}
