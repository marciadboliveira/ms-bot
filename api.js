var fetch = require('node-fetch');
var querystring = require('querystring');
var nconf = require('nconf');

var config = nconf.env().argv().file({file: 'localConfig.json'});


var BASE_URL = 'https://api.skimtechnologies.com/v2';

var headers = {
    'x-api-key': config.get("SKIM_API_TOKEN")
};

function recentNews(query) {
    var url = BASE_URL + '/bot/recent?' + querystring.stringify({'query': query});
    return fetch(url, option={
        'method': 'GET',
        'headers': headers
    }).then(res => res.json());
}


function getAlerts() {
    return fetch(BASE_URL + '/alerts', option={
        'method': 'GET',
        'headers': headers
    }).then(res => res.json());
}


/*
 title: string which represents the alert
 keyTerms: array of strings with key terms for the search
 */
function createAlert(title, keyTerms) {
    return fetch(BASE_URL + '/alerts', option={
        'method': 'POST',
        'headers': headers,
        'body': JSON.stringify({
            'title': title,
            'key_terms': keyTerms
        })
    }).then(res => res.json());
}

/*
 topics: should be a comma separated list of [investments, partnerships, acquisitions, personnel]
 since: ISO date time string
 */
function getAlert(alert_id, topics, since) {
    return fetch(BASE_URL + '/alerts/' + alert_id, option={
        'method': 'GET',
        'headers': headers,
        'body': JSON.stringify({
            'topics': topics,
            'since': since
        })
    }).then(res => res.json());
}


function deleteAlert(alert_id) {
    return fetch(BASE_URL + '/alerts/' + alert_id, option={
        'method': 'DELETE',
        'headers': headers
    }).then(res => res.json());
}

// createAlert('tesla', ['tesla', 'car'])
//     .then(json => console.log(json))
//     .catch(err => console.log(err));

// getAlerts()
//     .then(json => console.log(json))
//     .catch(err => console.log(err));

// deleteAlert('58fe0075c363060001b60d66')
//     .then(json => console.log(json))
//     .catch(err => console.log(err));

// getAlert('58fe0075c363060001b60d66').then(function(json) {
//     .then(json => console.log(json))
//     .catch(err => console.log(err));


module.exports = {
    'recentNews': recentNews,
    'getAlerts': getAlerts,
    'createAlert': createAlert,
    'getAlert': getAlert,
    'deleteAlert': deleteAlert
};
