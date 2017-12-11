const config = require('./config');
var Twit = require('twit');
var fetch = require('node-fetch');

var bitcoinData = {
  results: ''
};
var tickerApiUrl = "https://blockchain.info/ticker";
var chartsApiUrl = "https://api.coindesk.com/v1/bpi/historical/close.json";
// Predict for 3 days
var demandSearchParams = {
  q: '@coin_instinct Predict for #coininstinct since:2017-12-11', 
  count: 100
};
var bitcoinDropRatesSearchParams = {
  q: 'Bitcoin drops since:2017-12-11',
  count: 100
};

var twitClient = new Twit({
  consumer_key:         config.consumer_key,
  consumer_secret:      config.consumer_secret,
  access_token:         config.access_token,
  access_token_secret:  config.access_token_secret,
  timeout_ms:           60*1000,
});

refreshBitcoinPrices(tickerApiUrl);

work();

function work() {
  setInterval(function(){

    // Collects tweets that people tweeted to @coin_instinct
    collectTweets(demandSearchParams)
    .then((response) => {
      return response.data.statuses.map(status => status.text);
    })
    // When all the tweets are here, go through them, extract numbers and find most frequent day
    .then( (tweets) => {
      var requestedDays = [];

      tweets.forEach((tweet) => {
        var day = tweet.match(/\d+/g);
        requestedDays.push(day[0]);
      });
      return getMostFrequentDay(requestedDays);
    })
    // When most frequent day is found, get bitcoin value of that specific date in the history
    .then( (mostFrequentDay) => {
      return queryChartHistory(chartsApiUrl,mostFrequentDay);
    })
    // When bitcoin value for that specific date is found, calculate the ratio between current bitcoin value, and history bitcoin value
    .then( (pastBitcoinValue) => {
      return calculateRatio(pastBitcoinValue,bitcoinData.results.USD.last);
    })
    // When the ratio is calculated, get all tweets containing strings such as 'bitcoin drops' etc. to calculate disasterFactor
    .then( (ratio) => {
      console.log(ratio);
      // TODO get tweets containing bitcoin drops, etc, and calculate disaster factor
    })

  },3000);
}

/**
 * Collects tweets, based on parameters
 */
async function collectTweets(searchParams) {
  return await twitClient.get('search/tweets', searchParams);
}
/**
 * Finds the most frequent day in array of days, and returns it
 * @param {*Array} requestedDays Array of day values
 */
async function getMostFrequentDay(requestedDays) {
  if(requestedDays.length == 0) // TODO use custom array
  var convertedArray = requestedDays.map(Number);
  return await findMostFrequent(convertedArray);
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
    if(bitcoinData.results) {console.log('Blockchain API works!');}
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
 * Returns price of bitcoin for a specific date in history
 * @param {*String} chartsApiUrl API endpoint for getting bitcoin history values
 * @param {*String} daysInThePast how many days to go backwards
 */
async function queryChartHistory(chartsApiUrl, daysInThePast) {
  var date = new Date();
  date.setDate(date.getDate() - daysInThePast);
  date = date.toISOString().split('T')[0];
  
  const result = await fetch(chartsApiUrl+'?'+'start='+date+'&end='+date);
  const json = await result.json();
  return json.bpi[''+date];
}

async function calculateRatio(pastBitcoinValue,currentBitcoinValue) {
  return currentBitcoinValue-pastBitcoinValue;
}

/**
 * Algorithm behind finding the most frequent number in array
 * @param {*Array} array array of days
 */
async function findMostFrequent(array)
{
  // TODO ideja: kada uzme array taj i ispise onaj koji se najvise ponavlja da sacuva taj broj negde i sledeci put kada uzme, da ne bi ispisivao opet tipa za 5 dana, sada skloni taj najveci i ispisuje onaj sledeci najveci, u narednih tipa 3 sata, onda se sacuvani brojaci resetuju
    if(array.length == 0)
        return null;
    var modeMap = {};
    var maxEl = array[0], maxCount = 1;
    for(var i = 0; i < array.length; i++)
    {
        var el = array[i];
        if(modeMap[el] == null)
            modeMap[el] = 1;
        else
            modeMap[el]++;  
        if(modeMap[el] > maxCount)
        {
            maxEl = el;
            maxCount = modeMap[el];
        }
    }
    return maxEl;
}