const config = require('./config');
var Twit = require('twit');
var fetch = require('node-fetch');

var bitcoinData = {
  results: ''
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

//refreshBitcoinPrices(tickerApiUrl);

work();


// async function fetchBtc(tickerApiUrl) {
//   const response = await fetch(tickerApiUrl);
//   const btc = await response.json();
//   return btc;
// }

// async function fetch2(tickerApiUrl) {
//   const response = await fetch(tickerApiUrl);
//   const btc = await response.json();
//   return btc;
// }

function work() {
  setInterval(function(){
    
    // fetchBtc(tickerApiUrl).then((data) => {
    //   console.log('Izvrsena prva');
    //   fetch2(tickerApiUrl).then( (data) => {
    //     console.log('Izvrsena druga')
    //   } )
    // })

    collectTweetDemands().then(function(response) {
      console.log(response.data.statuses.map(status => status.text));
    })

  },3000);
}

/**
 * Collects users demands, how much days in the future to predict the value
 */
async function collectTweetDemands() {
  return await twitClient.get('search/tweets', {q: 'bitcoin since:2017-12-11T02:00', count: 2});
}

/**
 * Refreshes bitcoin prices minute before the main thread starts the work
 * @param {*String} tickerApiUrl API endpoint for getting the latest bitcoin prices 
 */
function refreshBitcoinPrices(tickerApiUrl) {
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
    //   refreshBitcoinPrices(tickerApiUrl,chartsApiUrl);
    //   console.log(bitcoinData.results);
    // },60000);
}

/**
 * Queries the CoinDesk api for specific date span
 * @param {*String} chartsApiUrl API endpoint for getting bitcoin history values
 * @param {*String} parameters query parameters
 */
function queryChartHistory(chartsApiUrl, parameters) {
  
}