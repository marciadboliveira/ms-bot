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
    var url = BASE_URL + '/alerts';
    return fetch(url, option={
        'method': 'GET',
        'headers': headers
    }).then(function(res) {
        return res.json()
    })
}
