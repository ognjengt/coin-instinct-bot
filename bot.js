/*
  ------------ TODOS -----------
  - Get current date on every tweet and put it in demandSearchParams since ✔️
  - Create a limit of the day, say remove every number from numbers array that is greater than 200
  - Figure out the 50 minute ratio ✔️
  - Figure out how to fire work function instantly first time, and THEN wait ✔️
  - Human factor
  - Do not repeat requests, tweet like 5 times, before ereasing blackList array, containing number of days you already predicted for ✔️
  - Refactor the code, add comments, explain functions etc...
  - Change the algorithm so you dont query the API everytime ✔️
  - Figure out how you will print out the people who tweeted, if the people who tweeted are = 0
*/
const { forEach } = require('p-iteration');
const format = require('number-format.js');

const config = require('./config');
var Twit = require('twit');
var fetch = require('node-fetch');
var humanFactorFunctions = require('./humanFactor');

var bitcoinData = {
  results: ''
};
const K = 10;
const QUERY_RANGE = 60;
const WORK_TIMEOUT = 1000*60*60; // should be 1000 * 60 * 60
const COIN_FETCH_TIMEOUT = 1000*60*55; // should be 1000 *60 * 55
const MAX_GENERATED_DAY_VALUE = 20;
const MIN_GENERATED_DAY_VALUE = 1;
const BLACKLIST_TIME_TO_CLEAR = 6;

var prediction = {};
var lastRequestedDaySpan = 0;
var lastNumberOfPeopleThatRequested = 0;
var tickerApiUrl = "https://blockchain.info/ticker";
var chartsApiUrl = "https://api.coindesk.com/v1/bpi/historical/close.json";
var coinDeskApiResults = {};

var blackListArray = [10,20];
var BLACKLIST_FILL_COUNTER = 0;

var todayDate = new Date();
todayDate = todayDate.toISOString().split('T')[0];
// Vidi kasnije da li je mozda bolje da tvituju bez #
var demandSearchParams = {
  q: '@coin_instinct Predict for since:2017-12-11', 
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
   run();
  setInterval(function(){

    run();

  },WORK_TIMEOUT);
}

function run() {
    // Collects tweets that people tweeted to @coin_instinct
    collectTweets(demandSearchParams)
    .then((response) => {
      return response.data.statuses.map(status => status.text);
    })
    // When all the tweets are here, go through them, extract numbers and find most frequent day
    .then( (tweets) => {
      var requestedDays = [];
      tweets = tweets.filter(tweet => tweet.includes('@coin_instinct Predict for'));
      console.log(tweets);

      tweets.forEach((tweet) => {
        var day = tweet.match(/\d+/g);
        requestedDays.push(day[0]);
      });
      this.lastNumberOfPeopleThatRequested = requestedDays.length;
      return getMostFrequentDay(requestedDays);
    })
    // When most frequent day is found, get bitcoin value of that specific date in the history
    .then( (mostFrequentDay) => {
      this.lastRequestedDaySpan = mostFrequentDay;
      return queryChartHistory(chartsApiUrl,mostFrequentDay);
    })
    // When the kNearest Neighbours algorithm is finished, get the start and end bitcoin value for the timespan in history, and calculate ratio between every one of them
    .then( (finalResults) => {
      return calculatePrediction(finalResults,bitcoinData.results.USD.last);
    })
    // When the prediction is calculated, get all tweets containing strings such as 'bitcoin drops' etc. to calculate humanFactor
    .then( (prediction) => {
      this.prediction = prediction;

      console.log('Prediction for the next '+this.lastRequestedDaySpan+' days is: '+this.prediction.finalValue);
      if(this.prediction.positive == 'true') {
        console.log('Gain: '+this.prediction.raw);
        console.log('Gain prctg: '+this.prediction.percentage);
      }
      else {
        console.log('Loss: '+this.prediction.raw);
        console.log('Loss prctg: '+this.prediction.percentage);
      }

      return collectTweets(bitcoinDropRatesSearchParams).then( (response) => {
        return response.data.statuses.map(status => status.text);
      })
    })
    .then( (negativeTweets) => {
        return humanFactorFunctions.calculateHumanFactor(negativeTweets);
    })
    .then( (humanFactor) => {
      // TODO multiply the prediction by human factor
      return tweetPrediction(this.prediction, this.lastRequestedDaySpan, this.lastNumberOfPeopleThatRequested);
    })
    .then( (tweetPostData) => {
      console.log('Tweeted!');
    })
}

/**
 * Collects tweets, based on parameters
 * @param {*Object} searchParams query
 */
async function collectTweets(searchParams) {
  return await twitClient.get('search/tweets', searchParams);
}

/**
 * Tweets the prediction!
 * @param {*Object} prediction Object containing prediction data
 * @param {*Number} lastRequestedDaySpan number of days in the future to predict
 * @param {*Number} peopleRequested number of people that requested this prediction
 */
async function tweetPrediction(prediction, lastRequestedDaySpan, peopleRequested) {
  var gainLoss = '';
  var percentageEmoji = '';
  if(prediction.positive == 'true')  {
    gainLoss = '📈 Gain'; 
    percentageEmoji = '⬆️';
  }
  else {
    gainLoss = '📉 Loss';
    percentageEmoji = '⬇️';
  }

  var tweetText = `Bitcoin value in the next ${lastRequestedDaySpan} days should be somewhere about 💰 $${format("#,##0.##",prediction.finalValue)}.
${gainLoss}: $${format("#,##0.##",prediction.raw)}
${gainLoss} percentage: ${prediction.percentage.toFixed(2)}% ${percentageEmoji}
${peopleRequested} 🤵 people requested this prediction.

Request a prediction by tweeting "@coin_instinct Predict for number days".
See you in an hour ⏲️
  `;
  //console.log(tweetText);
  //console.log('Note to self: Uncomment post line to tweet');
  return await twitClient.post('statuses/update', { status: tweetText });
}

/**
 * Finds the most frequent day in array of days, and returns it
 * @param {*Array} requestedDays Array of day values
 */
async function getMostFrequentDay(requestedDays) {
  // If no one requested this day, generate random day to predict for
  var convertedArray = [];
  if(requestedDays[0] != null) {
    convertedArray = requestedDays.map(Number);
    return await findMostFrequent(convertedArray, blackListArray);
  } else {
    return await generateRandom(blackListArray);
  }
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

    // Get todays date
    this.todayDate = new Date();
    this.todayDate = this.todayDate.toISOString().split('T')[0];
    console.log(this.todayDate);

    console.log('New prices fetched.');
    console.log('Most recent bitcoin price: '+bitcoinData.results.USD.last);
  }

    request(tickerApiUrl);

    // Enable in prod
    setInterval(() => {
      request(tickerApiUrl);
    },COIN_FETCH_TIMEOUT);
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

  var today = new Date();
  today.setDate(today.getDate() - 1);
  today = today.toISOString().split('T')[0];

  const results = await fetch(chartsApiUrl+'?start='+nMonthsBack+'&end='+nDaysBack);
  const resultsJson = await results.json();

  const fullResults = await fetch(chartsApiUrl+'?start='+nMonthsBack+'&end='+today);
  this.coinDeskApiResults = await fullResults.json();

  //console.log(resultsJson);

  const similarities = await calculateSimilarity(resultsJson, bitcoinData.results.USD.last);
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
async function calculateSimilarity(data, currentBTCValue) {
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
async function getFinalResults(kNearest,chartsApiUrl,nDays) { // remove chartsApiUrl from here if this works
  var finalResults = [];
  var finalResult = {};
  
  await forEach(kNearest, async(date) => {
    var dateTime = new Date(date);
    var pastDate = dateTime.toISOString().split('T')[0];

    var futureDate = new Date(date);
    futureDate.setDate(futureDate.getDate() + nDays);
    futureDate = futureDate.toISOString().split('T')[0];
    
    var valueForThatDay = this.coinDeskApiResults.bpi[pastDate];
    var valueForFutureDay = this.coinDeskApiResults.bpi[futureDate];

    finalResult = {
      start: valueForThatDay,
      end: valueForFutureDay
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
  var finalPredictionData = {
    raw: 0,
    percentage: 0,
    positive: '',
    finalValue: 0
  }
  var sum = 0;
  await forEach(data, async (value) => {
    sum += value.end - value.start;
  })

  sum = sum / K;
  finalPredictionData.raw = sum;
  finalPredictionData.finalValue = currentBitcoinValue + sum;
  finalPredictionData.positive = sum > 0 ? 'true' : 'false';
  finalPredictionData.percentage = ((finalPredictionData.finalValue - currentBitcoinValue) / currentBitcoinValue) * 100;
  return finalPredictionData;
}

/**
 * Generates random number, to predict for
 * @param {*Array} blackListArr Array of days that have already been predicted and tweeted for
 */
async function generateRandom(blackListArr) {
  var randomDay = 0;
  while(true) {
    randomDay = Math.floor(Math.random() * MAX_GENERATED_DAY_VALUE) + MIN_GENERATED_DAY_VALUE;
    if(blackListArr.includes(randomDay)) continue;
    else break;
  }
  addToBlackList(randomDay);
  return randomDay;
}

/**
 * Algorithm behind finding the most frequent number in array
 * @param {*Array} array array of days
 * @param {*Array} blackListArr blackList array
 */
async function findMostFrequent(array, blackListArr)
{
  // TODO ideja: kada uzme array taj i ispise onaj koji se najvise ponavlja da sacuva taj broj negde i sledeci put kada uzme, da ne bi ispisivao opet tipa za 5 dana, sada skloni taj najveci i ispisuje onaj sledeci najveci, u narednih tipa 3 sata, onda se sacuvani brojaci resetuju
    if(array.length == 0)
        return null;
    var modeMap = {};
    var maxEl = array[0], maxCount = 1;

    // First go through blackList array and set maxEl to the first element that isn't in the blacklist, if every of the numbers in the array is in the blacklist, then just return generateRandom

    var containsValidNumbers = false;
    for(var i = 0; i < array.length; i++) {
      if(!blackListArr.includes(array[i])) {
        maxEl = array[i];
        containsValidNumbers = true;
        break;
      }
    }
    if(!containsValidNumbers) return await generateRandom(blackListArr);

    for(var i = 0; i < array.length; i++)
    {
        var el = array[i];
        if(blackListArr.includes(el)) continue;
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
    await addToBlackList(maxEl);
    return maxEl;
    
}

/**
 * Adds newest day to blackList, so it wont tweet predictions for that day in the next 6 hours
 * @param {*Number} day day (number) to add to blackListArray
 */
async function addToBlackList(day) {
  if(BLACKLIST_FILL_COUNTER == BLACKLIST_TIME_TO_CLEAR) await clearBlackList();
  if(blackListArray.includes(day)) return;
  blackListArray.push(day);
  BLACKLIST_FILL_COUNTER++;
}

/**
 * Clears the blackListArray
 */
async function clearBlackList() {
  blackListArray = [];
  BLACKLIST_FILL_COUNTER = 0;
}