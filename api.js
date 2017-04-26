var fetch = require('node-fetch');
var querystring = require('querystring');
var nconf = require('nconf');

var config = nconf.env().argv().file({file: 'localConfig.json'});


var BASE_URL = 'https://api.skimtechnologies.com/v2';

var headers = {
    'x-api-key': config.get('SKIM_API_TOKEN')
};


function listAlerts() {
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
 topics: should be an array of strings: "acquisitions", "investments", "partnerships" or "personnel"
 since: ISO date time string
 */
function getAlert(alert_id, topics, since) {
    var params = {};
    if (topics !== undefined && topics.length) {
        params.topics = topics.join(',')
    }
    if (since !== undefined) {
        params.since = since
    }
    return fetch(BASE_URL + '/alerts/' + alert_id + '?' + querystring.stringify(params), option={
        'method': 'GET',
        'headers': headers
    }).then(res => res.json());
}

function deleteAlert(alert_id) {
    return fetch(BASE_URL + '/alerts/' + alert_id, option={
        'method': 'DELETE',
        'headers': headers
    }).then(res => res.json());
}

function getRecentNews(query, count) {
    var params = {'query': query};
    if (count !== undefined) {
        params.count = count;
    }
    return fetch(BASE_URL + '/bot/recent?' + querystring.stringify(params), option={
        'method': 'GET',
        'headers': headers
    }).then(res => res.json());
}


// listAlerts()
//     .then(json => console.log(json))
//     .catch(err => console.log(err));

// createAlert('microsoft', ['microsoft', 'bot', 'framework'])
//     .then(json => console.log(json))
//     .catch(err => console.log(err));

// deleteAlert('58fe5e9bc363060001b60d6a')
//     .then(json => console.log(json))
//     .catch(err => console.log(err));

// getAlert('58fe4ba8c363060001b60d69')
//     .then(json => console.log(json))
//     .catch(err => console.log(err));

// getAlert('58fe4ba8c363060001b60d69', ['acquisitions', 'partnerships'])
//     .then(json => console.log(json))
//     .catch(err => console.log(err));

// listAlerts()
//     .then(json => console.log(json))
//     .catch(err => console.log(err));

// getRecentNews('microsoft bot framework', 3)
//     .then(json => console.log(json))
//     .catch(err => console.log(err));

module.exports = {
    'listAlerts': listAlerts,
    'createAlert': createAlert,
    'getAlert': getAlert,
    'deleteAlert': deleteAlert,
    'getRecentNews': getRecentNews,
};
