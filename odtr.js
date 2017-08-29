'use strict';

const yaml = require('js-yaml');
const aws = require('aws-sdk');
const fs = require('fs');
const Browser = require("zombie");
var schema_cache = null;

/*
Universal Data Structure
{
    path:{
        action:""
    },
    querystring:{
        key:value
    },
    variable:{
        key:value
    }
}
*/

module.exports = {
    events: null,
    callback: null,
    bucket:null,
    file:null,
    globals:{browser:null},

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
            //self.componentHandler();
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
        var schema = action[check];
        let querieString = self.events.querystring;

        switch(check){
            case "querystring":{
                self.queryHandler(self, schema, querieString);
            }break;
            case "variable":{
                self.variableHandler(self, schema);
            }break;
            case "url":{
                self.urlHandler(self, schema);
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
    componentHandler: function(){
        let url = "https://odtr.awsys-i.com/jp-odtr/DTRMainLoginv2.aspx";
        let browser = new Browser();
        browser.visit(url, function(err) {
            try{
                browser.assert.success("Can't access remote server.");
            }catch(err){
                console.log(err.message);
            }
        })
    },
    /*
    - Handle globals
    - Check document url
    - Goto url
    */
    urlHandler: function(self, schema){
        //init globals
        if(self.globals.url == null){
            self.globals["url"] = {};
        }

        //Check if browser object is not null
        let browser = self.getBrowser(self);

        if(browser){
            let error = schema.error ? schema.error : " ";
            let path = schema.path;
            let action = schema.action;
    
            switch(action){
                case "assert":{
                    //Get the current browser location
                    //Check if same as given path
                    console.log("here");
                    browser.assert.url(path, error);
                }break;
                case "visit":{
                    //Visit the path given

                }break;
            }
        }
    },
    /*
    - Handle globals
    - Variable value set
    - Variable value check
    */
    variableHandler: function(self, schema){
        //init globals
        if(self.globals.variable == null){
            self.globals["variable"] = {};
        }

        let jsonKeys = Object.keys(schema);
        let parentError = schema.error ? schema.error : " ";
        
        //Check every variable
        jsonKeys.forEach(function(name) {
            //skip error
            if(name == "error"){
                return;
            }
            
            //Init variable properties
            let variable = schema[name];
            let value = variable.value;
            let type = variable.type ?variable.type : 'set';
            let error = variable.error;
            
            console.log("---"+ name + "[" + value + ", "+ type + "]");

            switch(type){
                case "set":{
                    self.globals.variable[name] = value;
                }break;
                case "assert":{
                    //Check if variable is in globals
                    //Check if value is same as given value
                    if(self.globals.variable[name] && self.globals.variable[name] == value){
                        //Nothing to do my dear.
                    }else{
                        throw new Error(parentError +" "+ error);
                    }
                }break;
            }

        });        

    },
    /*
    - Handle globals
    - Required query checking
    - Query type checking
    - Query format checking
    */
    queryHandler: function(self, schema, querieString){
        //init globals
        if(self.globals.querystring == null){
            self.globals["querystring"] = {};
        }

        //Get keys
        let queryKeys = Object.keys(querieString);
        let jsonKeys = Object.keys(schema);
        let parentError = schema.error ? schema.error : "No error message";
        
        //Check every action
        jsonKeys.forEach(function(key) {
            //skip error
            if(key == "error"){
                return;
            }

            let query = schema[key];
            let value = querieString[key];
            let type = query.type;
            let match = query.match;
            let required = query.required;
            let error = query.error ? query.error : "No error message";
            
            console.log("---"+key+"['"+ value + "'," + type + "," + match + "," + required + ",'" + error +"']");
            
            //Check if queries are in event
            let contains = queryKeys.indexOf(key) >= 0;
            if(!required || contains){
                //Value validity check
                if(self.validateString(type, match, value)){
                    //If Query is found Add to global
                    self.globals.querystring[key] = value;
                }else{
                    throw new Error(error);
                }
            }else{
                throw new Error(parentError);
            }
        });
    },
    notificationHandler: function(){
        
    },  
    /*
    - Check if string is of type
    - Check if string is of pattern/format
    */
    validateString: function(type, match, value){
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
                    return false;
                }
            }

            //Match -> regex pattern
            if(match){
                match = new RegExp(match, "g");
                if(value.match(match)){ //match === match value
                    //do nothing  
                }else{
                    return false;
                }
            }
        }
        return true;
    },
    getBrowser: function(self){
        if(self.globals.browser == null){
            console.log("Creating New Browser Object.");
            self.globals.browser = new Browser();
        }
        return self.globals.browser;
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