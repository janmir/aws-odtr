'use strict';

const odtr = require('./odtr');
const aws = require('aws-sdk');

module.exports.main = (events, context, callback) => {
  //update logging
  odtr.shouldLog(process.env.DEBUG === 'true');

  try {
    //Parse Yaml file
    let schema = odtr.loadSchema(process.env.DEPLOY === 'true');

    //JSON keys
    let jsonKeys = Object.keys(schema); 

    //Check every action
    jsonKeys.forEach(function(action) {
      
      console.log("Action: " + action);
      
      switch(action){
        case "login":
        case "check":
        case "time-in-out":{
          odtr.doAction(schema[action], events);
        }break;
        case "error":{

        }break;
      }
    });
  } catch (e) {
    console.error(e.message);
  }

  callback(null, {event:events});
};
