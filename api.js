var fetch = require('node-fetch');
var querystring = require('querystring');


var BASE_URL = 'https://api.skimtechnologies.com/v2';

var headers = {
    'x-api-key': process.env.SKIM_API_TOKEN
};

function recentNews(query) {
    var url = BASE_URL + '/bot/recent?' + querystring.stringify({'query': query});
    console.log(url);
    return fetch(url, option={
        'method': 'GET',
        'headers': headers
    }).then(function(res) {
        return res.json()
    })
}

recentNews('cortana').then(function(json) {
    console.log(json);
});
