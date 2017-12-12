var humanFactor = {};
var trainingData = require('./trainingData');

/**
 * Checks if the sentence contains some of the training data 
 * Returns an object containing number of matches from validDropData and invalidDropData for that sentence
 * @param {*string} sentence 
 */
async function runStringThroughTrainingData(sentence) {
  var result = {
    sentence: sentence,
    validDropData: [],
    invalidDropData: []
  }

  trainingData.invalidDropData.forEach( (trainData) => {
    if(sentence.includes(trainData)) {
      result.invalidDropData.push(trainData);
    }
  });

  trainingData.validDropData.forEach( (trainData) => {
    if(sentence.includes(trainData)) {
      result.validDropData.push(trainData);
    }
  });

  return result;
}
/**
 * Gets the sentences that contain valid or invalid data, as long with the trainingData that matches those sentences
 * @param {*Array} sentences 
 */
async function getValidSentences(sentences) {
  var validSentences = [];
  var matchesPromise = null;
  var matches = null;
  sentences.forEach( (sentence) => {
    runStringThroughTrainingData(sentence).then( (result) => {
      if(result.validDropData[0] || result.invalidDropData[0]) { // i ako vec ne containuje tu recenicu
        validSentences.push(result);
      }
    })
    
  })
  return validSentences;
}

/**
 * Returns the human factor
 * @param {*Array} sentences 
 */
humanFactor.calculateHumanFactor = async (sentences) => {
  var validSentences = await getValidSentences(sentences);
  // Go through all of the sentences and calculate, if it has lets say 3 validDropData, then the higher the disasterFactor is.


  return 0.5;
}

module.exports = humanFactor;