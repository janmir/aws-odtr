'use strict';

const odtr = require('./odtr');

module.exports.main = (events, context, callback) => {  
  //init globals
  odtr.callback = callback;
  odtr.events = events;
  odtr.bucket = process.env.BUCKET;
  odtr.file = process.env.FILE;
  
  //update logging
  odtr.shouldLog(process.env.DEBUG === 'true');

  //log value
  console.log("----------Events-----------");
  console.log(events);
  
  //Parse Yaml file & pass to main handler
  odtr.loadSchema(process.env.DEPLOY === 'true', odtr.main);
};