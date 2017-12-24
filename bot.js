/*
  ------------ TODOS -----------
  - Create a limit of the day, say remove every number from numbers array that is greater than 200
  - Human factor
  - Refactor the code, add comments, explain functions etc...
  - Figure out how you will print out the people who tweeted, if the people who tweeted are = 0
*/
const { forEach } = require('p-iteration');
const format = require('number-format.js');
const fs = require('fs');

const config = require('./config');
var Twit = require('twit');
var fetch = require('node-fetch');
var humanFactorFunctions = require('./humanFactor');

var bitcoinData = {
  results: ''
};
const K = 10;
const QUERY_RANGE = 60; // How much days to go back in history to search for results (QUERY_RANGE + requestedDays)
const WORK_TIMEOUT = 1000*60*120; // Wake the bot every 2 hours (tweet every 2 hours)
const COIN_FETCH_TIMEOUT = 1000*60*118; // Fetch latest bitcoin prices 2 minutes before the bot awakens
const MAX_GENERATED_DAY_VALUE = 20;
const MIN_GENERATED_DAY_VALUE = 1;
const BLACKLIST_TIME_TO_CLEAR = 4;

var prediction = {};
var lastRequestedDaySpan = 0;
var lastNumberOfPeopleThatRequested = 0;
var tickerApiUrl = "https://blockchain.info/ticker";
var chartsApiUrl = "https://api.coindesk.com/v1/bpi/historical/close.json";
var coinDeskApiResults = {};

var blackListArray = [9,15,19,18,17,16];
var BLACKLIST_FILL_COUNTER = 0;

var todayDate = new Date();
todayDate = todayDate.toISOString().split('T')[0];
// Vidi kasnije da li je mozda bolje da tvituju bez #
var demandSearchParams = {
  q: '@coin_instinct Predict for since:'+todayDate, 
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
      tweets = tweets.filter(tweet => tweet.includes('@coin_instinct Predict for') || tweet.includes('@coin_instinct predict for'));
      console.log(tweets);

      tweets.forEach((tweet) => {
        var day = tweet.match(/\d+/g);
        requestedDays.push(day[0]);
      });
      this.lastNumberOfPeopleThatRequested = requestedDays.length;
      return getMostFrequentDay(requestedDays);
    })
    // When most frequent day is found, run the algorithm and get final results
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

      console.log('Time of prediction: '+new Date().getHours()+':'+new Date().getMinutes());
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
      return writeToDump(this.prediction);
    })
    .then( () => {
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
  var peopleData = '';
  if(prediction.positive == 'true')  {
    gainLoss = '📈 Gain'; 
    percentageEmoji = '⬆️';
  }
  else {
    gainLoss = '📉 Loss';
    percentageEmoji = '⬇️';
  }

  if(peopleRequested == 0) {
    peopleData = 'No one requested a prediction in this cycle.'
  } else peopleData = peopleRequested+' 🤵 people requested this prediction.';

  var tweetText = `#Bitcoin value in the next ${lastRequestedDaySpan} days should be somewhere about 💰 $${format("#,##0.##",prediction.finalValue)}.
${gainLoss}: $${format("#,##0.##",prediction.raw)}
${gainLoss} percentage: ${prediction.percentage.toFixed(2)}% ${percentageEmoji}
${peopleData}
💎 Current BTC value: $${format("#,##0.##",bitcoinData.results.USD.last)}

Request a prediction by tweeting "@coin_instinct Predict for number days".
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
    console.log('Time: '+new Date().getHours()+':'+new Date().getMinutes());
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
  const finalResults = await getFinalResults(kNearest,nDays);
  console.log(kNearest);
  console.log(finalResults);
   
  return finalResults;
}

/**
 * Calculates the similarity score (distance between current bitcoin value and all of the other bitcoin values in the past)
 * Returns JSON object with similarity scores ID: date, value: the similarity between current btc value and the value on that day (the lower the number, they are more similar)
 * @param {*Object} data Data from QUERY_RANGE days back
 * @param {*Int} currentBTCValue Current bitcoin value
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
 * @param {*Array} similarities data with all of the similarity scores compared to current bitcoin value, all the way up to QUERY_RANGE days back
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
 * @param {*Array} kNearest Array of dates for which the bitcoin value was the most similar to current btc value
 * @param {*Int} nDays Days to go in the future, and get the value of btc on that date, to compare
 */
async function getFinalResults(kNearest,nDays) {
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
 * @param {*Array} data Array of objects, containing start and end bitcoin values
 * @param {*Float} currentBitcoinValue Current btc value
 */
async function calculatePrediction(data,currentBitcoinValue) {
  
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
  lastNumberOfPeopleThatRequested = 0;
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
    lastNumberOfPeopleThatRequested = maxCount;
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

  console.log('---Current blacklist---');
  console.log(blackListArray);
  console.log('---BLACKLIST_FILL_COUNTER: '+BLACKLIST_FILL_COUNTER+'---');
}

/**
 * Clears the blackListArray
 */
async function clearBlackList() {
  blackListArray = [];
  BLACKLIST_FILL_COUNTER = 0;

  console.log('---- BLACKLIST CLEARED ----')
}

/**
 * Creates a file and writes all of the todays predictions in it
 * @param {*Object} prediction 
 * @param {*Date} todaysDate 
 */
async function writeToDump(prediction) {
  // TODO write to file
  var today = new Date();
  today = today.toISOString().split('T')[0];
  var pathToFile = './dumps/'+today+'_dump.txt';

  var futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + this.lastRequestedDaySpan);
  futureDate = futureDate.toISOString().split('T')[0];
  var lineToWrite = futureDate+':'+prediction.finalValue+'\n';

  if (!fs.existsSync(pathToFile)) {
    fs.writeFileSync(pathToFile,'');
  }
  fs.appendFileSync(pathToFile,lineToWrite);
}