'use strict';

const yaml = require('js-yaml');
const aws = require('aws-sdk');
const fs = require('fs');
const Browser = require("zombie");
var schema_cache = null;

module.exports = {
    events: null,
    callback: null,
    bucket:null,
    file:null,
    globals:{},

    main: function(self, schema){
        const act = self.events.path.action;

        //cache schema
        schema_cache = schema;

        //log value
        console.log(schema);
        console.log("------Action: "+ act +"-------");

        try {    
            //JSON keys
            let jsonKeys = Object.keys(schema); 
                        
            //Check every action
            jsonKeys.forEach(function(action) {
                if(act === action){
                    console.log("Action: " + action);
                    
                    switch(action){
                        case "login":
                        case "check":
                        case "time-in-out":{
                            self.doAction(self, schema[action]);
                        }break;
                        case "error":break;
                    }
                }
            });

            console.log("----------------------------");
            self.componentHandler();
            self.callback(null, {"":""});  

        } catch (err) {
            console.log("----------------------------");
            self.callback(err, null);  
        }
    },
    doAction: function(self, action){
        //Check prerequisites
        if(action.if){
            console.log("-If:");

            //Check every action
            let jsonKeys = Object.keys(action.if);
            jsonKeys.forEach(function(key) {
                console.log("--"+key);

                //Call If handler
                self.doIf(self, action.if, key);
            });
        }

        //Print global values
        console.log(self.globals);        

        //Do actions
        if(action.then){
            console.log("-Then:");

            //Check every action
            let jsonKeys = Object.keys(action.then);
            jsonKeys.forEach(function(key) {
                console.log("--"+key);

                //Call If handler
                self.doThen(self, action.then, key);
            });
        }

        //Create output
        if(action.then){
            console.log("-That:");
        }
    },
    doIf: function(self, action, check){
        var json = action[check];
        let jsonKeys = Object.keys(json);
        let querieString = self.events.querystring;

        switch(check){
            case "querystring":{
                //init globals
                if(self.globals.query == null){
                    self.globals["query"] = {};
                }

                let queryKeys = Object.keys(querieString);

                //Check every action
                jsonKeys.forEach(function(key) {
                    console.log("---"+key);

                    let obj = json[key];
                    let value = querieString[key];
                    let type = obj.type;
                    let match = obj.match;
                    let required = obj.required;

                    //Check if queries are in event
                    let contains = queryKeys.indexOf(key) >= 0;
                    if(!required || contains){
                        //Value validity check
                        if(self.validate(type, match, value)){
                            //If Query is found Add to global
                            self.globals.query[key] = value;
                        }else{
                            throw new Error("Invalid query request string value.");
                        }
                    }else{
                        throw new Error("Key '"+key+"' is missing from query request string.");
                    }
                });
            }break;
            case "variable":{
                //Check every action
                jsonKeys.forEach(function(type) {
                    console.log("---"+type);
                    
                    //Check if variable is in globals

                    //Check if value is same as given
                });        
            }break;
        }
    },
    doThen: function(self, action, check){
        var json = action[check];
        let jsonKeys = Object.keys(json);

        switch(check){
            case "component":{
                //Check every action
                jsonKeys.forEach(function(key) {
                    console.log("---"+key);
                });
            }break;
            case "variable":{
            }break;
            case "action":{
            }break;
        }
    },
    doThat: function(self, action, check){
        var json = action[check];
        let jsonKeys = Object.keys(json);

        switch(check){
            case "component":{
                //Check every action
                jsonKeys.forEach(function(key) {
                    console.log("---"+key);
                });
            }break;
            case "action":{
            }break;
        }
    },
    urlHandler: function(){

    },
    componentHandler: function(){
        let url = "https://odtr.awsys-i.com/jp-odtr/DTRMainLoginv2x.aspx";
        let browser = new Browser();
        browser.visit(url, function(err) {
            try{
                browser.assert.success("Can't access remote server.");
            }catch(err){
                console.log(err.message);
            }
        })
    },
    variableHandler: function(){

    },
    queryHandler: function(){
         
    },
    notificationHandler: function(){
        
    },  
    validate: function(type, match, value){
        if(value){
            //Type -> number | string
            if(type){
                //check number - int, no support for float yet
                let re = /\b\d+/g;
                let isNum = value.match(re);
                let value_type = !isNum ? 'string': 'number';
    
                if(value_type === type){ //type === typeof value
                  //do nothing  
                }else{
                    throw new Error("Value '" + value + "' has type '" + 
                    value_type + "' expected is " + type + ".");
                }
            }

            //Match -> regex pattern
            if(match){
                match = new RegExp(match, "g");
                if(value.match(match)){ //match === match value
                    //do nothing  
                }else{
                    throw new Error("Value '" + value + "' does not match with expected format '" + 
                    match + "'.");
                }
            }
        }
        return true;
    },        
    shouldLog: function(log_flag){
        if(!log_flag){
            console.log = function() {};
        }
    },
	loadSchema: function(deploy_flag, callback){
        const self =  module.exports;
        const filename = 'schema.yaml';
        const bucket = 'janmir';

        try{
            if(schema_cache != null){
                console.log("//From Cache");
                callback(self, schema_cache);
            }else{
                if(!deploy_flag){
                    console.log("//From Local");
        
                    //Get from local file
                    let file = fs.readFileSync(__dirname +'/' + filename, 'utf8')
                    let config = yaml.safeLoad(file);
                    let indentedJson = JSON.stringify(config, null, 4);
        
                    callback(self, JSON.parse(indentedJson));
                }else{
                    console.log("//From Bucket");
        
                    //Get from S3
                    let s3 = new aws.S3();
                    var params = {
                        Bucket: bucket,
                        Key: filename
                    }
                    s3.getObject(params, function(err, data) {
                        if(!err){ 
                            let file = data.Body.toString('utf-8');
                            let config = yaml.safeLoad(file);
                            let indentedJson = JSON.stringify(config, null, 4);
                
                            callback(self, JSON.parse(indentedJson));
                        }else{
                            self.callback(err, null);
                        } 
                    });
                }
            }
        } catch (err) {
            console.log("----------------------------");            
            self.callback(err, null);
        }
    }
}