var HtmlReporter = require('protractor-beautiful-reporter');
exports.config = {
  directConnect: true,
  capabilities: {
    'browserName': 'chrome'
  },
  framework: 'jasmine',
  specs: ['example_spec.js'],
  onPrepare: function() 
  {
    jasmine.getEnv().addReporter(new HtmlReporter({ 
    baseDirectory: 'Reports/screenshots'
  }).getJasmine2Reporter());
  },
  jasmineNodeOpts: {
    defaultTimeoutInterval: 30000
  }
};
