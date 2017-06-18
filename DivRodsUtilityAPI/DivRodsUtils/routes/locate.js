var express = require('express');
var router = express.Router();
var async = require('async'), fs = require('fs'), request = require('request');

//Just passing a request through to the tracking API and responding with a small packet
router.post('/', function(req, res, next) {
    request.post(
        FINDhost,
        req.body,
        function (error, response, body) {
            if (!error && response.statusCode == 200) {
                var jsonresp = JSON.parse(response.body);
                //could do some massaging here
                var devicelocation = jsonresp["location"];
                console.log(jsonresp["location"])
                if(req.query.deviceid){
                    req.app.get('_DeviceSessions')._place(req.query.deviceid, devicelocation);
                }
                res.status(200).send(devicelocation);
            }
        }
    );
});

module.exports = router;
