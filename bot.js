const { forEach } = require('p-iteration');
const config = require('./config');
var Twit = require('twit');
var fetch = require('node-fetch');
var humanFactorFunctions = require('./humanFactor');

var bitcoinData = {
  results: ''
};
const K = 10;
const QUERY_RANGE = 60;
var prediction = 0;
var tickerApiUrl = "https://blockchain.info/ticker";
var chartsApiUrl = "https://api.coindesk.com/v1/bpi/historical/close.json";
// Vidi kasnije da li je mozda bolje da tvituju bez #
var demandSearchParams = {
  q: '@coin_instinct Predict for #coininstinct since:2017-12-11', 
  count: 100
};
var bitcoinDropRatesSearchParams = {
  q: 'bitcoin will drop',
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
      tweets = tweets.filter(tweet => tweet.includes('@coin_instinct Predict for') && tweet.includes('#coininstinct'));
      console.log(tweets);

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
    // When the kNearest Neighbours algorithm is finished, get the start and end bitcoin value for the timespan in history, and calculate ratio between every one of them
    .then( (finalResults) => {
      return calculatePrediction(finalResults,bitcoinData.results.USD.last);
    })
    // When the ratio is calculated, get all tweets containing strings such as 'bitcoin drops' etc. to calculate humanFactor
    .then( (prediction) => {
      this.prediction = prediction;
      console.log(this.prediction);
      return collectTweets(bitcoinDropRatesSearchParams).then( (response) => {
        return response.data.statuses.map(status => status.text);
      })
    })
    .then( (negativeTweets) => {
        return humanFactorFunctions.calculateHumanFactor(negativeTweets);
    })
    .then( (humanFactor) => {
       console.log('Human factor: '+humanFactor);
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
  //if(!requestedDays) // TODO use custom array
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

    console.log('New prices fetched.');
    console.log('Most recent bitcoin price: '+bitcoinData.results.USD.last);
  }

    request(tickerApiUrl);

    // Enable in prod
    // setInterval(() => {
    //   request(tickerApiUrl,chartsApiUrl);
    // },10000);
}

/**
 * Queries the CoinDesk api for specific date span
 * Returns array of bitcoin values based on k nearest neighbours, start - value on the start day, end - value after n days
 * @param {*String} chartsApiUrl API endpoint for getting bitcoin history values
 * @param {*String} nDays how many days to go backwards
 */
async function queryChartHistory(chartsApiUrl, nDays) {

  var nDaysBack = new Date();
  nDaysBack.setDate(nDaysBack.getDate() - (nDays+1));
  nDaysBack = nDaysBack.toISOString().split('T')[0];

  var nMonthsBack = new Date();
  nMonthsBack.setDate(nMonthsBack.getDate() - (nDays+1) - QUERY_RANGE);
  nMonthsBack = nMonthsBack.toISOString().split('T')[0];

  const results = await fetch(chartsApiUrl+'?start='+nMonthsBack+'&end='+nDaysBack);
  const resultsJson = await results.json();
  //console.log(resultsJson);

  const similarities = await calculateSimilarity(resultsJson, chartsApiUrl, bitcoinData.results.USD.last);
  const kNearest = await getNearestNeighbours(similarities);
  const finalResults = await getFinalResults(kNearest,chartsApiUrl,nDays);
  console.log(kNearest);
  console.log(finalResults);
   
  return finalResults;
}

/**
 * Calculates the similarity score (distance between current bitcoin value and all of the other bitcoin values in the past)
 * Returns JSON object with similarity scores ID: date, value: the similarity between current btc value and the value on that day (the lower the number, they are more similar)
 * @param {*Object} data 
 * @param {*String} chartsApiUrl 
 * @param {*Int} currentBTCValue 
 */
async function calculateSimilarity(data, chartsApiUrl, currentBTCValue) {
  // Go through all and calculate currentBtc - data[key]
  var similarities = [];
  /*
    Similarity object looks something like this:
    {
      date: '2017-10-08',
      similarityScore: 1140 (difference between current BTC and btc on that day)
    }
  */
  Object.keys(data.bpi).forEach( (key,index) => {
    var similarity = {
      date: key,
      similarityScore: currentBTCValue - data.bpi[key]
    }
    similarities.push(similarity);
  });
  return similarities;
}

/**
 * Returns k nearest neighbours (dates) based on similarityScores
 * @param {*Array} similarities data with all of the similarity scores compared to current bitcoin value, all the way up to 2 months back
 */
async function getNearestNeighbours(similarities) {
  // Run through, and find k(10) that are closest to 0
  var absSimilarities = [];
  similarities.forEach( (similarity) => {
    absSimilarities.push({
      date: similarity.date,
      similarityScore: Math.abs(similarity.similarityScore)
    })
  })
  absSimilarities = absSimilarities.sort(function(a,b) {
    return (a.similarityScore > b.similarityScore) ? 1 : ((b.similarityScore > a.similarityScore) ? -1 : 0);
  });
  var kNearest = [];
  for(var i = 0; i < K; i++) {
    kNearest.push(absSimilarities[i].date);
  }
  return kNearest;
}

/**
 * Returns array of objects containing start and end values
 * start - value of bitcoin on the start day
 * end - value of bitcoin after n days
 * @param {*Array} kNearest 
 * @param {*String} chartsApiUrl 
 * @param {*Int} nDays 
 */
async function getFinalResults(kNearest,chartsApiUrl,nDays) {
  var finalResults = [];
  var finalResult = {};
  
  await forEach(kNearest, async(date) => {
    var dateTime = new Date(date);
    var pastDate = dateTime.toISOString().split('T')[0];

    var futureDate = new Date(date);
    futureDate.setDate(futureDate.getDate() + nDays);
    futureDate = futureDate.toISOString().split('T')[0];

    var valueForThatDay = await fetch(chartsApiUrl+'?start='+pastDate+'&end='+pastDate);
    var valueForThatDayJson = await valueForThatDay.json();

    var valueForFutureDay = await fetch(chartsApiUrl+'?start='+futureDate+'&end='+futureDate);
    var valueForFutureDayJson = await valueForFutureDay.json();

    finalResult = {
      start: valueForThatDayJson.bpi[''+pastDate],
      end: valueForFutureDayJson.bpi[''+futureDate]
    }

    finalResults.push(finalResult);
  })
  return finalResults;

}

/**
 * Calculates the prediction
 * Returns object containing valuable data for prediction
 * @param {*Float} pastBitcoinValue 
 * @param {*Float} currentBitcoinValue 
 */
async function calculatePrediction(data,currentBitcoinValue) {
  // za primljen niz objekata iz funkcije queryChartHistory, prodji kroz svaki izracunaj razliku end-a i start-a, saberi to sve
  // izracunaj prosecnu vrednost povecanja ili smanjenja bitcoina, to sve sabrano / brojdatuma koji se uzimao, npr 5
  // vrati prosecnu vrednost porasta ili pada u narednih n dana
  var sum = 0;
  await forEach(data, async (value) => {
    sum += value.end - value.start;
  })

  sum = sum / K;
  return sum;
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