'use strict';

const odtr = require('./odtr');
const now = require("performance-now");

module.exports.main = (events, context, callback) => { 
  //Performance logging
  odtr.performance.start = now();

  //init globals
  odtr.callback = callback;
  odtr.events = events;
  odtr.bucket = process.env.BUCKET;
  odtr.file = process.env.FILE;
  odtr.deploy = process.env.DEPLOY === 'true';
  
  //log value
  console.log("----------Events-----------");
  console.log(events);
  console.log("----------Schema-----------");

  //update logging
  odtr.shouldLog(process.env.DEBUG === 'true');
  
  //Parse Yaml file & pass to main handler & enjoi!
  odtr.loadSchema(odtr.main);
};