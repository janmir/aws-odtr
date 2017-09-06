'use strict';

const yaml = require('js-yaml');
const aws = require('aws-sdk');
const fs = require('fs');
const request = require("request");
const sync = require('deasync');
const $ = require('fast-html-parser');
const moment = require('moment-timezone');

var schema_cache = null;

/*
{
    "path" : {
            "action" : "login"
    },
    "querystring" : {
            "password" : "*******",
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
    current_time: null,
    global:{
        request: null,
        cookies: {},
        env: {}
    },
    result:{
        result: false
    },
    //response: null,
    html: null,

    main: function(self, schema){

        //try {
        const act = self.events.path.action;
        const que = self.events.querystring;
        
        //cache schema
        schema_cache = schema;

        //log value
        console.log(schema);
        console.log("------Action: "+ act +"---------------------------------------");

        if(act){
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
                        case "biteme":
                        case "bitemenot":{
                            if(que){
                                self.doAction(self, schema[action], que);
                                actionPerformed = true;
                            }else{
                                throw new Error("Critical: Please provide required parameters.");
                            }
                        }break;
                        case "wakeup":{
                            actionPerformed = true;
                            self.result.result = true;
                            self.result.status = 'awake';
                        }break;
                        case "error":break;
                    }
                    return;
                }
            });

            if(!actionPerformed){
                throw new Error("Critical: No Action was perfomed for "+action+", Incorrect Action maybe?");
            }
            
            //Print global values
            console.log("------------GLOBAL------------");
            console.log(self.global);                        
            console.log("------------RESULTS------------");
            
            self.callback(null, self.result);  
            self.cleanUp(self);            
        }else{
            throw new Error("Critical: Please specify action to be performed.");
        }
        /*} catch (err) {
            //Print global values
            console.log("------------GLOBAL------------");
            console.log(self.global); 
            console.log("------------ERROR-RESULTS------------");
            
            self.result.result = false;            
            self.callback(err, self.result);  
            self.cleanUp(self);
        }*/
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
            case "components":{
                self.componentsHandler(self, schema);
            }break;
            case "variable":{
                self.variableHandler(self, schema);                
            }break;
            case "actions":{
                self.actionsHandler(self, schema);
            }break;
            case "return":{
                self.returnHandler(self, schema);
            }break;
            case "url":{
                self.urlHandler(self, schema);
            }break;
            case "notify":{
                self.notificationHandler(self, schema);
            }break;
        }
    },
    /*
    { 
        url: 'https://example.com',
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
                            let val = self.evaluateValue(value);

                            console.log("----body: "+key+":"+val);
                            tBody += key + "=" + 
                                     val + 
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
                body: body ? body : null,
                jar: cookieJar
            };

            console.log("*******************<Payload Start>*********************");
            console.log(options);
            console.log("*******************<Payload End>***********************");
            console.log("*******************" + method + ": "  + url + "********");
            
            //Perform HTTP Request
            request(options, function(error, _response, _body){
                if (!error) {
                    console.log("<Request Done...>");
                    response = _response;
                    done = true;
                }else{
                    throw new Error("On request error: " + error.message);
                }
            });

            //Loop while its not yet done.
            console.log("<Waiting for async task to finish...>");
            sync.loopWhile(()=>{return !done});
            console.log("<Continue...>");
            
            /********************Do processing of response here********************/
            //HTML Parse body
            var html = $.parse(response.body);
            self.html = html;

            //Checks
            if(checks){
                Object.keys(checks).forEach((key) => {
                    let value = checks[key];

                    //Check Known Keys
                    switch(key){
                        case "statusCode":{
                            console.log("<Status Code["+url+"]: "+ response.statusCode +">")                            
                            if(response.statusCode != value){
                                //Check first if component exist
                                //Copy content as error message
                                let re = /^\#\S+\b/;
                                if(error.match(re)){
                                    //Matched error message convert to values
                                    let node = html.querySelector(error);
                                    if(node){
                                        error = node.text.trim() + ".";
                                        self.global.env.error = error;
                                    }else{
                                        error = "An unknown error occured.";
                                    }
                                }   

                                //Throw an error
                                //throw new Error(error + " Expected statuscode of "+ value +
                                //" did not match with Response " + response.statusCode);
                                throw new Error(error);
                            }
                        }break;
                    }
                });
            }

            //All Pass store current location
            self.global.env.location = response.request.href;
            //self.response = response;
            console.log("<Current Location: "+ self.global.env.location +">");

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

            //Store listed id values in 'cache' to global variables
            if(cache){
                console.log("<Title: "+ html.querySelector('title').text +">")

                Object.keys(cache).forEach((key) => {
                    let value = cache[key];
                    console.log("----cache: "+key+":"+value);

                    //Store in global cache
                    let node = html.querySelector(value);
                    if(node){
                        let encodedValue = encodeURIComponent(node.attributes.value);
                        self.global.env[key] = encodedValue;
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
            { path: 'https://example.com',
                action: 'visit',
                error: 'Unable to access path.' } },
    then: 
        { actions: { 'visit-page': [Object] }, requests: [ [Object] ] },
    that:
        { url:
            { path: 'https://example.com',
                action: 'assert',
                error: 'Unable to login.' },
            variable: { 'logged-in': true, type: 'set' } 
            } 
        }
    }
    */
    actionsHandler: function(self, schema){
        //Check every variable

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
                        let value = queries[key];
                        let val = self.evaluateValue(value);

                        querystring[key] = val;
                    });
                }
            }

            self.doAction(self, schema_cache[action], querystring);
        });
    },
    returnHandler: function(self, schema){
        Object.keys(schema).forEach(function(key) {
            let value = schema[key];
            var val = value;
            if(typeof value == "string"){
                let re = /^[env.\S]+\s[>\-\+\*<]\s[env.\S]+\b/;
                
                //Match check format
                if(value.match(re)){
                    //split by space first
                    let tokens = value.split(" ");
                    if(tokens.length == 3){
                        try{
                            val = eval("module.exports.global." + tokens[0] + " " + tokens[1] + " " + "module.exports.global." + tokens[2]);
                        }catch(err){
                            val = 0;
                        }
                    }
                }else{
                    val = self.evaluateValue(value);
                }

            }

            console.log("---[" + key + ", " + value + ", " + val + "]");
            if(val !== ""){
                self.result[key] = val; 
            }
        });            
    },        
    /*
    - Handle globals
    - Check if component exist
    - Set component values
    - Get component values
    */
    componentsHandler: function(self, schema){
        
        //Check every action
        schema.forEach(function(key) {
            let selector = key.selector;
            let name = key.name;
            let action = key.action;
            let error = key.error ? key.error : "Can't locate " + selector + ".";
            let notFound = key.notFound;

            console.log("---[" + name + ", " + selector + ", " + action + "]");
            
            if(self.html){
                //Assert if element exists
                let elements = self.html.querySelectorAll(selector);
                if(elements.length > 0){
                    switch(action){
                        case "get":{
                            let tVal = elements[elements.length-1].text.trim();
                            //console.log("component:" + name + ":'" + tVal + "'");
                            
                            if(tVal.length > 0 && !isNaN(tVal)){
                                self.global.env[name] = parseFloat(tVal);
                            }else{
                                self.global.env[name] = tVal;
                            }
                            
                        }break;
                        case "merge":{
                            // Miranda, Jan Paul |	Dev 5 |	Lenovo |	08:52 AM |	09:37 AM | 0.76                            
                            var value = "";
                            elements.forEach((element)=>{
                                let val = element.text.trim();
                                if(val !== ""){
                                    value +=  val + " | ";
                                }
                            });
                            self.global.env[name] = value.substr(0, value.length - 3);
                        }break;
                        case "split":{
                            var value = "";
                            let separator = "|";

                            //Merge all data
                            elements.forEach((element)=>{
                                let val = element.text.trim();
                                if(val !== ""){
                                    value +=  val + separator;
                                }
                            });
                            
                            value = value.substr(0, value.length - 1)

                            //Split that shit baby :D
                            if(value && value.length > 0){
                                let index = 0;
                                value.split(separator).forEach((element) => {
                                    self.global.env[name + index] = element;
                                    index++;
                                });
                            }
                        }break;
                    }
                }else{
                    //throw new Error("Can't find component.");
                    self.global.env[name] = "";

                    if(notFound){
                        self.global.env[notFound] = true;
                    }
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
                    console.log("<Assert Current Location: "+ self.global.env.location +">");
                    if(self.global.env.location != path){
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
            let type = variable.type ? variable.type : 'set';
            let error = variable.error;
            let override = variable.override ? self.evaluateValue(variable.override) : false;
            override = override ? override : false;
            
            //Evaluate override's value
            console.log("---"+ name + "[" + type + ", "+ value + "("+ typeof value + "), "+override+"]");
 
            switch(type){
                case "set":{
                    if(typeof value == "string"){
                        let re = /^\w+\(\)$/;
                        if(value.match(re)){
                            //call known function
                            switch(value){
                                case "timenow()":{
                                    value = moment().tz('Asia/Tokyo').format('hh:mm A');
                                }break;
                                case "daynow()":{
                                    value = moment().tz('Asia/Tokyo').format('e');
                                    value = parseInt(value);                                    
                                    if(value == 0){
                                        value = 7;
                                    }
                                }break;
                            }
                        }
                    }

                    self.global.env[name] = value;
                }break;
                case "equal":{
                    //Check if variable is in globals
                    //Check if value is same as given value
                    if(!override){
                        if(self.global.env[name]){
                            if(self.global.env[name] != value){
                                throw new Error(parentError +" "+ error);
                            }
                        }else{
                            throw new Error(parentError +" "+ error);
                        }
                    }else{
                        console.log("<Override on equal check>");
                    }
                }break;
                case "greater":{
                    if(!override){
                        if(self.global.env[name]){
                            if(self.global.env[name] <= value){
                                throw new Error(parentError +" "+ error);
                            }
                        }else{
                            throw new Error(parentError +" "+ error);
                        }
                    }else{
                        console.log("<Override on greater than check>");
                    }
                }break;
                case "less":{
                    if(!override){
                        if(self.global.env[name]){
                            if(self.global.env[name] >= value){
                                throw new Error(parentError +" "+ error);
                            }
                        }else{
                            throw new Error(parentError +" "+ error);
                        }
                    }else{
                        console.log("<Override on less than check>");
                    }
                }break;
                case "in":{
                    //support for value is in array[1, 2, ...]
                }break;
                case "evaluate":{
                    //Temporary value
                    let tVal = value;
                    let re = /^[env.\S]+\s[>\-\+\*<]\s[env.\S]+\b/;

                    //Match check format
                    if(value.match(re)){
                        //split by space first
                        //tVal = eval(value);
                    }
                }break;
                //Special ODTR only
                case "evaluate-time-now":{
                    //Temporary value
                    var tVal = value;
                    let re = /\b[a-z]+\.[_a-z]+/g;

                    //Match check format
                    if(value.match(re)){
                        //Get string time value
                        try {
                            tVal = eval("module.exports.global." + value);

                            //Convert to time object
                            tVal = moment(tVal, 'hh:mm A');
                            let timeNow = moment(self.global.env.timenow, 'hh:mm A');
                            
                            //Subtract with time now
                            tVal = timeNow.diff(tVal, 'hours');
                        } catch (error) {
                            tVal = 0;
                        }
                    }

                    //Store data in global
                    self.global.env[name] = tVal;
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

        console.log("<QueryString>");
        console.log(querieString);

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
                    console.log("<Set: "+key+" to '"+value+"'>");

                    if(value){
                        self.global.env[key] = value;
                    }
                }else{
                    throw new Error(error);
                }
            }else{
                throw new Error(parentError);
            }
            console.log("<Pass>");
        });
    },
    notificationHandler: function(self, schema){
        
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
    evaluateValue: function(value){
        let re = /\b[a-z]+\.[_a-z]+/g;
        let isString = typeof value == "string";
        if(isString && value.match(re)){
            try {
                value = eval("module.exports.global." + value);
            } catch (error) {
                value = null;
                //throw new Error(error.message);
            }
        }
        return value;
    },
    shouldLog: function(log_flag){
        if(!log_flag){
            console.log = function(str) {};
        }
    },
	loadSchema: function(main){
        const self =  module.exports;
        const deploy_flag = self.deploy;
        const filename = self.file;

        try{
            //temp email
            var ses = new aws.SES();

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
                            throw new Error(err.message);
                        } 
                    });
                }
            }
        } catch (error) {
            console.log("------------GLOBAL------------");
            console.log(self.global); 
            console.log("------------ERROR-RESULTS------------");

            //Make Error Message
            self.result = {};
            self.result.result = false;
            self.result.message = error.message;

            self.callback(null, self.result);  
            self.cleanUp(self);
        }
    },
    cleanUp: function(self){
        console.log("<**************Cleanup Start**************>");
        //Clean it all!!!!
        self.deploy = false;
        self.events = null;
        self.callback = null;
        self.bucket = null;
        self.file = null;
        self.global = {
            request: null,
            cookies: {},
            env: {}
        };
        self.result = {};
        self.html = null;
        console.log("<**************Cleanup End**************>");
    }
}