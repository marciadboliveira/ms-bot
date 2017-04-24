var fetch = require('node-fetch');
var querystring = require('querystring');


var BASE_URL = 'https://api.skimtechnologies.com/v2';

var headers = {
    'x-api-key': process.env.SKIM_API_TOKEN
};

function recentNews(query) {
    var url = BASE_URL + '/bot/recent?' + querystring.stringify({'query': query});
    return fetch(url, option={
        'method': 'GET',
        'headers': headers
    }).then(function(res) {
        return res.json()
    })
}


function getAlerts() {
    return fetch(BASE_URL + '/alerts', option={
        'method': 'GET',
        'headers': headers
    }).then(function(res) {
        return res.json()
    })
}


function createAlert(title, keyTerms) {
    var body = {
        'title': title,
        'key_terms': keyTerms
    };
    return fetch(BASE_URL + '/alerts', option={
        'method': 'POST',
        'headers': headers,
        'body': JSON.stringify(body)
    }).then(function(res) {
        return res.json();
    })
}


function deleteAlert(alert_id) {
    return fetch(BASE_URL + '/alerts/' + alert_id, option={
        'method': 'DELETE',
        'headers': headers
    }).then(function(res) {
        return res.json();
    })
}

// createAlert('tesla', ['tesla', 'car']).then(function(json) {
//     console.log(json);
// }).catch(function(err) {
//     console.log(err);
// });

// deleteAlert('58fde614c363060001b60d65').then(function(json) {
//     console.log(json);
// }).catch(function(err) {
//     console.log(err);
// });

// getAlerts().then(function(json) {
//     console.log(json);
// }).catch(function(err) {
//     console.log(err);
// });
