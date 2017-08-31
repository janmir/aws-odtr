'use strict';

const odtr = require('./odtr');

module.exports.main = (events, context, callback) => {  
  //init globals
  odtr.callback = callback;
  odtr.events = events;
  odtr.bucket = process.env.BUCKET;
  odtr.file = process.env.FILE;
  odtr.deploy = process.env.DEPLOY === 'true';
  
  //update logging
  odtr.shouldLog(process.env.DEBUG === 'true');

  //log value
  console.log("----------Events-----------");
  console.log(events);
  console.log("----------Schema-----------");
  
  //Parse Yaml file & pass to main handler & enjoi!
  odtr.loadSchema(odtr.main);
};