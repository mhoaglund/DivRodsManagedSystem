var CronJob = require('cron').CronJob, request = require('request');

class ArtworkFilter {
    constructor(_host, _freq, _tz){
        this.host = _host;
        this.cronfreq = _freq;
        this.currently_up = {};
        this.broken_rules = 0;
        new CronJob(this.cronfreq, function() {
            this._refresh();
        }, null, true, _tz);
    }
    _refresh(){
        //TODO make call to collection service, parse result into artids
        request.get(
            this.host,
            function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    //loop through hits from collection, filter for artids and isondisplay or whatever
                    var _resp = JSON.parse(response.body);
                    _resp.hits.forEach(function(element) {
                        if(element["_id"]){
                            //Something
                        }
                        else continue;
                    }, this);
                }
            }
        );
        this.broken_rules = 0;
    }
    _filter(_ruleset){
        //TODO filter a whole ruleset and remove any rules pertaining to artwork that isn't on display
    }
    _check(_artid){
        //TODO given a single artid, see if it's a valid one that is currently on display
    }
}