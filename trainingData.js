const validDropData = [
  'will drop tomorrow', 'is likely to drop tomorrow', 'will drop', 'is likely to drop', 'says bitcoin will drop', 'are saying bitcoin will drop', 'is going to drop', 'bitcoin price will go down', 'bitcoin will drop', 'bitcoin is likely to drop soon', 'will drop soon', "bitcoin's value will drop soon", 'drop in the next 2 days', 'drop in the next 3 days', 'drop in the next 4 days', 'drop in the next 5 days', 'will drop in the next', 'felt bitcoin will drop',' feel bitcoin will drop', 'will drop a bit', 'I think bitcoin will drop', 'price will fall', 'bitcoin will fall', 'bitcoin will drop $',' will drop to $', '#bitcoin will drop', 'feel #bitcoin will drop', 'says #bitcoin will drop','are saying #bitcoin will drop', '#bitcoin value will drop soon', 'sell now', 'you should sell', 'you should start selling', 'sell bitcoin fast', 'sell #bitcoin fast', 'going to drop', 'going to drop a lot', 'bitcoin is going to drop a lot over next', 'bitcoin is going to drop over next', 'bitcoin is going to drop over the next', 'bitcoin is going to drop a lot over the next',''
];
const invalidDropData = [
  'will drop once', 'will not drop', 'if bitcoin will drop', 'will drop if', 'bitcoin will drop if', 'will bitcoin drop', 'when bitcoin will drop', 'when #bitcoin will drop', "don't sell", 'do not sell', 'you should not sell', "don't sell bitcoin", 'you should not sell bitcoin', "you shouldn't sell bitcoin","don't sell #bitcoin", 'you should not sell #bitcoin', "you shouldn't sell #bitcoin"
];

module.exports = {
  validDropData,
  invalidDropData
}