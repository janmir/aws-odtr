'use strict';

const yaml = require('js-yaml');
const aws = require('aws-sdk');
const fs = require('fs');
const request = require("request");
const sync = require('deasync');
const $ = require('fast-html-parser');

var schema_cache = null;

/*
{
    "path" : {
            "action" : "login"
    },
    "querystring" : {
            "password" : "awsol+123",
            "username" : "jp.miranda"
    }
}
*/

module.exports = {
    deploy: false,
    events: null,
    callback: null,
    bucket:null,
    file:null,
    global:{
        location: null,
        request: null,
        cookies: {},
        env: {}
    },
    result:{},

    main: function(self, schema){

        try {
            const act = self.events.path.action;
            const que = self.events.querystring;
            
            //cache schema
            schema_cache = schema;
    
            //log value
            console.log(schema);
            console.log("------Action: "+ act +"---------------------------------------");

            if(act && que){
                //JSON keys
                let jsonKeys = Object.keys(schema); 
                let actionPerformed = false;
                
                //Check every action
                jsonKeys.forEach(function(action) {
                    if(act === action){
                        console.log("Action: " + action);
                        
                        switch(action){
                            case "login":
                            case "check":
                            case "time-in-out":{
                                self.doAction(self, schema[action], que);

                                actionPerformed = true;
                            }break;
                            case "error":break;
                        }
                    }
                });

                if(!actionPerformed){
                    throw new Error("Critical: No Action was perfomed, Are you sure you of what you're doing?.");
                }
                
                //Print global values
                console.log("------------GLOBAL------------");
                console.log(self.global);                        
                console.log("------------RESULTS------------");
                self.result.url = self.global.location;
                self.callback(null, self.result);  
                self.cleanUp(self);            
            }else{
                throw new Error("Critical: Please specify action to be performed and provide required parameters.");
            }
        } catch (err) {
            //Print global values
            console.log("------------GLOBAL------------");
            console.log(self.global); 
            console.log("------------ERROR-RESULTS------------");
            self.callback(err, self.result);  
            self.cleanUp(self);
        }
    },
    doAction: function(self, action, querystring){
        //console.log(action);
        //Check prerequisites
        if(action.if){
            console.log("-If:");

            //Check every action
            let jsonKeys = Object.keys(action.if);
            jsonKeys.forEach(function(key) {
                console.log("--"+key);

                //Call If handler
                self.doIf(self, action.if, key, querystring);
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
    },
    doIf: function(self, action, check, querieString){
        var schema = action[check];

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
            case "requests":{
                self.requestsHandler(self, schema);
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
    /*
    { 
        url: 'https://odtr.awsys-i.com/jp-odtr/DTRMainLoginv2.aspx',
        method: 'GET',
        headers: {},
        body: ' ',
        jar:
        RequestJar {
            _jar: CookieJar { enableLooseMode: true, store: { idx: {} } } } 
    }
    */
    requestsHandler: function(self, schema){
        //Check every variable
        schema.forEach(function(key) {
            let url = key.url;
            let method = key.method ? key.method : "GET";
            let header = key.header ? key.header : {};
            let cache = key.cache ? key.cache : null;
            let checks = key.checks;
            let body = key.body ? key.body : null;
            let error = key.error ? key.error : "No Error Message.";
            
            console.log("---******" + method + ": "  + url + "******");

            var done = false;
            var response = null;
            var cookieJar = request.jar();

            //Format body based on Content-Type
            if(body && header){
                switch(header["Content-Type"]){
                    //Known content types
                    case "application/x-www-form-urlencoded":{
                        var tBody = "";
                        Object.keys(body).forEach((key) => {
                            let value = body[key];
                            
                            //get value
                            let separator = "&";
                            var val = value;
                            let re = /\b[a-z]+\.[_a-z]+/g;
                            if(value.match(re)){
                                try {
                                    val = eval("module.exports.global." + value);
                                } catch (error) {
                                    throw new Error(error.message);
                                }
                            }

                            console.log("----body: "+key+":"+val);
                            tBody += encodeURIComponent(key) + "=" + 
                                     encodeURIComponent(val) + 
                                     separator;
                        });
                        body = tBody.substr(0, tBody.length - 1);

                        //Save content length to be used by header
                        self.global.env.contentLength = body.length;
                    }break;
                    case "application/json":{

                    }break;
                }
            }

            //Format headers
            //Need to add existing cookie to header
            let cookey = Object.keys(self.global.cookies);
            if(cookey.length > 0){
                var cookieString = "";
                let separator = ";";
                cookey.forEach((key) => {
                    cookieString += key + "=" + self.global.cookies[key] + separator;
                });

                header.Cookie = cookieString.substr(0, cookieString.length - 1);
            }

            //Create request options
            var options = {
                url: url,
                method: method,
                headers: header,
                body: body ? body : "",
                jar: cookieJar
            };

            console.log("<*******************Payload Start>*********************");
            console.log(options);
            console.log("<*******************Payload End>*********************");
            
            //Perform HTTP Request
            request(options, function(error, _response, _body){
                if (!error) {
                    response = _response;
                    done = true;
                }else{
                    throw new Error("On request error: " + error.message);
                }
            });

            //Loop while its not yet done.
            console.log("<Waiting for async task to finish...>");
            sync.loopWhile(function(){return !done});
            console.log("<Header Location: "+ response.headers.location +">");
            
            /********************Do processing of response here********************/
            //Checks
            if(checks){
                Object.keys(checks).forEach((key) => {
                    let value = checks[key];

                    //Check Known Keys
                    switch(key){
                        case "statusCode":{
                            console.log("<Status Code: "+ response.statusCode +">")                            
                            if(response.statusCode != value)
                                throw new Error(error + " Statuscode "+ value +
                                    " did not match with Response " + response.statusCode);
                        }break;
                    }
                });
            }

            //All pass store cookies
            var cookies = cookieJar._jar.toJSON();
            if(cookies.cookies.length > 0){
                cookies.cookies.forEach((cookie) => {
                    let value = cookie.value ? cookie.value : "";
                    console.log("----cookie: "+cookie.key+": "+value);
                    
                    //Store in global cache
                    self.global.cookies[cookie.key] = value;
                });
            }

            //All Pass store current location
            self.global.location = response.request.href;

            //Store listed id values in 'cache' to global variables
            var html = null;
            if(cache){
                //HTML Parse body
                html = $.parse(response.body);
                console.log("<Title: "+ html.querySelector('title').text +">")

                Object.keys(cache).forEach((key) => {
                    let value = cache[key];
                    console.log("----cache: "+key+":"+value);

                    //Store in global cache
                    let node = html.querySelector(value);
                    if(node){
                        self.global.env[key] = node.attributes.value;
                    }
                });
            }

            //Handler redirects manually
            if(response.statusCode == 302){
                console.log("<Redirecting to: "+ response.headers.location +">");
            }
        });
    },
    /*
    { if:
        { querystring:
            { username: [Object],
                password: [Object],
                error: 'Missing required parameter, did you miss anything?' },
            url:
            { path: 'https://odtr.awsys-i.com/jp-odtr/DTRMainLoginv2.aspx',
                action: 'visit',
                error: 'Unable to access path.' } },
    then: 
        { actions: { 'visit-page': [Object] }, requests: [ [Object] ] },
    that:
        { url:
            { path: 'https://odtr.awsys-i.com/jp-odtr/DTRMainv2.aspx',
                action: 'assert',
                error: 'Unable to login.' },
            variable: { 'logged-in': true, type: 'set' } 
            } 
        }
    }
    */
    actionsHandler: function(self, schema){
        //Check every variable
        console.log(schema);

        Object.keys(schema).forEach(function(action) {
            console.log("---" + action);
            console.log("Action: " + action);    
            
            let queries = schema[action];
            
            //Add values to query string
            let querystring = null;
            if(queries){
                let queriesKeys = Object.keys(queries);
                if(queriesKeys.length > 0){
                    querystring = {};
                    queriesKeys.forEach(function(key) {
                        querystring[key] = queries[key];
                    });
                }
            }

            console.log(querystring);
            self.doAction(self, schema_cache[action], null);
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
        if(self.global.components == null){
            self.global["components"] = {};
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
                        self.global.components[name] = val;
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
                    case "button":{
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
        /*if(self.global.url == null){
            self.global["url"] = {};
        }*/

        let request = self.getRequestObject(self);

        if(request){
            let error = schema.error ? schema.error : " ";
            let path = schema.path;
            let action = schema.action;

            //Request params
            let cache = schema.cache ? schema.cache : [];
            let checks = schema.checks ? schema.checks : {};
            
            console.log("---[" + path + ", "+ action + ", " + error + "]");
    
            switch(action){
                case "assert":{
                    //Get the current browser location
                    //Check if same as given path
                    console.log("<Current Location: "+ self.global.location +">");
                    if(self.global.location != path){
                        throw new Error(error);
                    }
                }break;
                case "visit":{
                    //Visit the path given
                    let data = [{ 
                        url: path,
                        method: "GET",
                        cache: cache,
                        checks: checks,
                        header: null,
                        cookie: null,
                        error: error 
                    }];
                    
                    self.requestsHandler(self, data);
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
                    self.global.env[name] = value;
                }break;
                case "assert":{
                    //Check if variable is in globals
                    //Check if value is same as given value
                    if(self.global.env[name] && self.global.env[name] == value){
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

        if(querieString == null){
            throw new Error("Critical: Missing Query String.");
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
                    self.global.env[key] = value;
                }else{
                    throw new Error(error);
                }
            }else{
                throw new Error(parentError);
            }
                    console.log("<Pass>");
        });
    },
    notificationHandler: function(){
        
    },
    getRequestObject(self){
        if(self.global.request == null){
            self.global.request = request.defaults({
                jar: true,
                followRedirect: true,
                followOriginalHttpMethod: true
            });
        }

        return self.global.request;
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
                if(value_type != type){ //type === typeof value
                    return false;
                }
            }

            //Match -> regex pattern
            if(match){
                match = new RegExp(match);
                if(!value.match(match)){ //match === match value
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
	loadSchema: function(main){
        const self =  module.exports;
        const deploy_flag = self.deploy;
        const filename = self.file;

        try{
            if(schema_cache != null){
                console.log("//From Cache");
                main(self, schema_cache);
            }else{
                if(!deploy_flag){
                    console.log("//From Local");
        
                    //Get from local file
                    let file = fs.readFileSync(__dirname +'/' + filename, 'utf8')
                    let config = yaml.safeLoad(file);
                    let indentedJson = JSON.stringify(config, null, 4);
        
                    main(self, JSON.parse(indentedJson));
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
                
                            main(self, JSON.parse(indentedJson));
                        }else{
                            self.callback(err, self.result);
                        } 
                    });
                }
            }
        } catch (err) {
            console.log("--------------ERROR-RESULT--------------");       
            self.callback(err, self.result);
            self.cleanUp(self);
        }
    },
    cleanUp: function(self){
        console.log("<**************Cleanup**************>");
        //Clean it all!!!!
        self.deploy = false;
        self.events = null;
        self.callback = null;
        self.bucket = null;
        self.file = null;
        self.global = {
            location: null,
            request: null,
            cookies: {},
            env: {}
        };
        self.result = {};
    }
}