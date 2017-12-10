const config = require('./config');
var Twit = require('twit');
var fetch = require('node-fetch');

var bitcoinData = {
  results: '',
  history: ''
};
var tickerApiUrl = "https://blockchain.info/ticker";
var chartsApiUrl = "https://api.coindesk.com/v1/bpi/historical/close.json";

var twitClient = new Twit({
  consumer_key:         config.consumer_key,
  consumer_secret:      config.consumer_secret,
  access_token:         config.access_token,
  access_token_secret:  config.access_token_secret,
  timeout_ms:           60*1000,
});

refresh(tickerApiUrl);
queryChartHistory(chartsApiUrl,'');




/**
 * Refreshes bitcoin prices
 * @param {*String} tickerApiUrl API endpoint for getting the latest bitcoin prices 
 */
function refresh(tickerApiUrl) {
  const request = async (tickerApiUrl) => {
    var results = await fetch(tickerApiUrl);
    results = await results.json();

    bitcoinData.results = results;
    if(bitcoinData.results) {console.log('Blockchain API works!'); console.log(bitcoinData)}
    else console.log('Blockchain API is down at the moment.');
  }

    request(tickerApiUrl);

    // Enable in prod
    // setInterval(() => {
    //   refresh(tickerApiUrl,chartsApiUrl);
    //   console.log(bitcoinData.results);
    // },60000);
}

/**
 * Queries the CoinDesk api for specific date span
 * @param {*String} chartsApiUrl API endpoint for getting bitcoin history values
 * @param {*String} parameters query parameters
 */
function queryChartHistory(chartsApiUrl, parameters) {
  const request = async (chartsApiUrl,parameters) => {
    var history = await fetch(chartsApiUrl+'?'+parameters);
    history = await history.json();
    
    bitcoinData.history = history;
    if(bitcoinData.history) {console.log('History charts API works'); console.log(bitcoinData)}
    else console.log('History charts API is down at the moment.');
  }

  request(chartsApiUrl,parameters);
}