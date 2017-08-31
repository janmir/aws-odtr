'use strict';

const yaml = require('js-yaml');
const aws = require('aws-sdk');
const fs = require('fs');
const request = require("request");
const sync = require('deasync');
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
    deploy: false,
    events: null,
    callback: null,
    bucket:null,
    file:null,
    globals:{
        browser:null
    },

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
        if(action.that){
            console.log("-That:");

            //Check every action
            let jsonKeys = Object.keys(action.that);
            jsonKeys.forEach(function(key) {
                console.log("--"+key);

                //Call If handler
                self.doThat(self, action.that, key);
            });
        }

        //Print global values
        console.log("------------GLOBAL------------");
        console.log(self.globals);                        
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
        var schema = action[check];

        switch(check){
            case "components":{
                self.componentsHandler(self, schema);
            }break;
            case "variable":{
                self.variableHandler(self, schema);                
            }break;
            case "actions":{
                self.actionsHandler(self, schema);
            }break;
            case "url":{
                self.urlHandler(self, schema);
            }break;
        }
    },
    doThat: function(self, action, check){
        var schema = action[check];
        
        switch(check){
            case "variable":{
                self.variableHandler(self, schema);                
            }break;
            case "actions":{
                self.actionsHandler(self, schema);
            }break;
            case "url":{
                self.urlHandler(self, schema);
            }break;
        }
    },
    actionsHandler: function(self, schema){
        //Check every variable
        Object.keys(schema).forEach(function(key) {
            console.log("---" + key);
        });
    },
    /*
    - Handle globals
    - Check if component exist
    - Set component values
    - Get component values
    */
    componentsHandler: function(self, schema){
        //init globals
        if(self.globals.components == null){
            self.globals["components"] = {};
        }
        
        //Check every action
        schema.forEach(function(key) {
            let selector = key.selector;
            let name = key.name;
            let type = key.type;
            let value = key.value;
            let action = key.action;
            let error = key.error ? key.error : "Can't locate " + selector + ".";

            console.log("---[" + name + ", " + selector + ", "+ type + ", " + value + ", " + action + "]");
            
            if(true){
                //Assert if element exists

                switch(action){
                    case "get":{
                        var val = " ";
                        //Prepares value
                        if(type == "input"){
                        }else{
                        }
                        console.log("<Get: '"+val+"'>");
                        //Gets a value and save it to globals.components.<name>
                        self.globals.components[name] = val;
                    }break;
                    case "set":{
                        //get value
                        var val = value;
                        let re = /\b[a-z]+\.[a-z]+/g;
                        if(value.match(re)){
                            console.log("<Match>");
                            try {
                                val = eval("module.exports.globals." + value);
                            } catch (error) {
                                throw new Error(error.message);
                            }
                        }

                        //Set the value
                        if(type == "input"){
                            console.log("<Set: '"+val+"'>");
                        }else{
                            //using native innerHTML
                        }
                    }break;
                    case "submit":{
                        var done = false;

                        console.log("<Submitting Form...>"); 
                        
                    }break;
                }
            }else{
                throw new Error("Can't access the remote location.");
            }
        });        
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

        if(true){
            let error = schema.error ? schema.error : " ";
            let path = schema.path;
            let action = schema.action;

            console.log("---[" + path + ", "+ action + ", " + error + "]");
    
            switch(action){
                case "assert":{
                    //Get the current browser location
                    //Check if same as given path
                    if(true){

                    }else{
                        throw new Error(error);
                    }
                }break;
                case "visit":{
                    //Have to convert this to async
                    var done = false;

                    //Visit the path given
                    

                    //loop while its not yet done.
                    console.log("<Waiting for async task to finish...>");
                    //sync.loopWhile(function(){return !done;});
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

        let parentError = schema.error ? schema.error : " ";
        
        //Check every variable
        Object.keys(schema).forEach(function(name) {
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
                let re = /^\d+\b/;
                let isNum = value.match(re);
                let value_type = !isNum ? 'string': 'number';
    
                console.log("<Type: " +value_type+ ">");
                if(value_type === type){ //type === typeof value
                  //do nothing  
                }else{
                    return false;
                }
            }

            //Match -> regex pattern
            if(match){
                match = new RegExp(match);
                if(value.match(match)){ //match === match value
                    //do nothing  
                }else{
                    return false;
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
	loadSchema: function(callback){
        const self =  module.exports;
        const deploy_flag = self.deploy;
        const filename = self.file;

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
                        Bucket: self.bucket,
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