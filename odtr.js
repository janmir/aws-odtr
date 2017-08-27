const yaml = require('js-yaml');
const fs = require('fs');

module.exports = {
    shouldLog: function(log_flag){
        if(!log_flag){
            console.log = function() {};
        }
    },
	loadSchema: function(deploy_flag){
		try {
            var indentedJson;
            
            if(!deploy_flag){
                //Get from local file
                let config = yaml.safeLoad(fs.readFileSync(__dirname +'/schema.yaml', 'utf8'));
                indentedJson = JSON.stringify(config, null, 4);
            }else{
                //Get from S3
                let s3 = new aws.S3();
                var getParams = {
                    Bucket: 'janmir', // your bucket name,
                    Key: 'schema.yaml' // path to the object you're looking for
                }
            }

            return JSON.parse(indentedJson);
        } catch (e) {
        }
    },
    doAction: function(action, events){
        //Check prerequisites
        if(action.if){
            console.log("If:");
        }

        //Do actions
        if(action.then){
            console.log("Then:");
        }

        //Create output
        if(action.then){
            console.log("That:");
        }
    }
}