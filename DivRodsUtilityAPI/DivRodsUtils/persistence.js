const uuidV4 = require('uuid/v4');
var _ = require('underscore'), request = require('request'), ClientOAuth2 = require('client-oauth2'), winston = require('winston');
var moment = require('moment'), prefclient = require('./prefclient.js');

var idtags = [
        {"artid":"111619", "color":"purple"},
        {"artid":"492", "color":"yellow"},
        {"artid":"3903", "color":"red"},
        {"artid":"31412", "color":"cyan"},
        {"artid":"31377", "color":"green"},
        {"artid":"66176", "color":"purple"},
        {"artid":"9671", "color":"yellow"},
        {"artid":"3908", "color":"red"},
        {"artid":"3220", "color":"cyan"},
        {"artid":"191", "color":"green"},
        {"artid":"118619", "color":"green"},
        {"artid":"4688", "color":"purple"},
        {"artid":"17169", "color":"yellow"},
        {"artid":"60752", "color":"red"},
        {"artid":"802", "color":"cyan"},
        {"artid":"1163", "color":"green"},
        {"artid":"1808", "color":"purple"},
        {"artid":"1773", "color":"yellow"},
        {"artid":"14011", "color":"red"},
        {"artid":"589", "color":"cyan"},
        {"artid":"1372", "color":"green"},
        {"artid":"1378", "color":"purple"}
];

/**
 * A session object to keep track of devices. Handles auth, interactions with pref engine, and report generation.
 */
class DeviceSession {
    constructor(DeviceMAC, timestamp, session_dict, floor = _DefaultFloor){
        this.DeviceID = DeviceMAC;
        this.SessionID = uuidV4();
        this.Opened = timestamp;
        this.LastTouched = timestamp;
        this.Closed = {};
        this.BaseRuleSet = {};
        this.RuleSet = {};
        this.PrefHistory = [];
        this.Location = "0";
        this.SetupCode = 1;
        this.CurrentPath = {};
        this.CurrentFloor = floor;
        this.CurrentPrefTarget = {};
        this.LocHistory = [];
        this.Enabled = true;
        this.Status = "Normal";
        this.Manager = session_dict;

        //var randomtag = Object.keys(floortestdata[floor])[Math.floor(Math.random() * Object.keys(floortestdata[floor]).length)];
        //this.CurrentPrefTarget = floortestdata[floor][randomtag];
        //TODO redo this initial setting.
        var initial_target_id = _.last(this.Manager.rules)["ant"].slice(0,-2);
        this.CurrentPrefTarget = _.find(this.Manager.art_filter.taggedworks, {artid:initial_target_id}); 
    }
    //submit a record of a session of usage
    _drop_report(){

    }
    _get_consequent(pref){
        //TODO based on a pref, look for a likely consequent in the latest association rules,
        //maybe triggering a refresh. Validate found consequents against tagged works list.
    }
    _change_floor(floor){
        this.CurrentFloor = floor;
    }
    //submit a user's expressed preference about an artwork
    _submit_pref(pref, floor){
        if(!floor | floor == undefined){
            floor = this.CurrentFloor;
        }
        var self = this;
        pref["timestamp"] = moment.now();
        var correct = pref["artid"] == this.CurrentPrefTarget["artid"];
        pref["target"] = correct;
        if(correct){
            var pref_string = (pref["pref"] == "n") ? pref["artid"] + ":0" : pref["artid"] + ":1";
            //var matchedpref = _.find(this.Manager.rules, {ant:pref["artid"]});
            var matchedprefs = _.filter(this.Manager.rules, function(o){
                return o["ant"] == pref_string;
            });
            if(matchedprefs){
                //get hydrated artwork objects for these consequent IDs
                var matched_valid_artworks = [];
                matchedprefs.forEach(function(matched){
                    var con_id = matched["con"].slice(0,-2);
                    var mva = _.find(self.Manager.art_filter.taggedworks, {artid:con_id});
                    if(mva) matched_valid_artworks.push(mva);
                });
                _next = matchedprefs[0]["con"].slice(0,-2);
            } else{
                //look for a different artid that is in a different gallery.
                var artobj = _.find(this.Manager.art_filter.taggedworks, {artid:pref["artid"]});
                var otherart = this.Manager.art_filter.taggedworks.filter(function(tagged){
                    return tagged["artid"] != pref["artid"] && tagged["room"] != artobj["room"];
                });
                _next = otherart[Math.floor(Math.random() * otherart.length)];
            }
            this.CurrentPrefTarget = _.find(_ArtFilter.taggedworks, {artid:_next});  
        }
        //prefclient.record_preference(this.SessionID, pref["artid"], pref["pref"], function(data){
            //TODO: figure out another endpoint that gets us a consequent.
        //});
        this.PrefHistory.push(pref);
        return correct;
    }
    _validate(_artid){
        if(_.find(this.Manager.art_filter.taggedworks, {artid:_artid})) return true;
        else return false;
    }
    _setup(code){
        //TODO setup stuff. whatever we want. at first, we're controlling the walking radius.
        this.SetupCode = code;
    }
    _close(reason, timestamp){
        this.Enabled = false;
        this.Closed = {"reason":reason, "time": timestamp};
    }
};

class SessionDictionary {
    constructor(_exp, _art_filter){
        this.Expiration = _exp;
        this.Sessions = [];
        var self = this;
        this.ruleset = {};
        this.rules = [];
        this.art_filter = _art_filter;
        this._update_ruleset();
    }

    _check_and_clear_expirations(){
        var _now = Date.now();
        for(var index in this.Sessions){
            var session = this.Sessions[index];
            var _stale = Math.abs(_now - session.LastTouched);
            if(_stale > this.Expiration){
                session.Enabled = false;
            }
        }
        var clear = 0;
        var i = this.Sessions.length
        while (i--) {
            if(!this.Sessions[i].Enabled){
                this.Sessions.splice(i,1);
                clear++;
            }
        }
        var logstring = 'Session cron cleared ' + clear + ' dormant sessions.';
        console.log(logstring);
    }
    _touch(reqID, dict, status = null){
        var found = _.find(this.Sessions, {DeviceID:reqID});
        if(found){
            if(status){
                found.Status = status;
            }
            found.LastTouched = Date.now();
        }
        else{
            var _time = Date.now();
            var _new = new DeviceSession(reqID, _time, dict);
            _new.LastTouched = Date.now();
            this.Sessions.push(_new);
        }
        console.log("Touched: ");
        console.log(reqID);
    }
    _get(reqID){
        var found = _.find(this.Sessions, {DeviceID:reqID});
        if(found){
            return found;
        }
    }
    _overview(pretty){
        var out = [];
        this.Sessions.forEach(function(session){
            var sample = {
                "ID": session.SessionID,
                "Location": session.Location,
                "LocationHistory": session.LocHistory,
                "Awake": session.Enabled,
                "Started": new Date(session.Opened).toISOString(),
                "CurrentPath": pretty ? JSON.stringify(session.CurrentPath) : session.CurrentPath,
                "CurrentTarget": JSON.stringify(session.CurrentPrefTarget),
                "Status": session.Status,
                "ScannedTags": session.PrefHistory
            }
            out.push(sample);
        });
        return out;
    }
    _place(deviceid, location){
        var found = _.find(this.Sessions, {DeviceID:deviceid});
        if(found){
            var _now = Date.now();
            found.Location = location;
            if(found.LocHistory.length < 1){
                found.LocHistory.push({"loc":location, "time":_now});
            }
            else if(found.LocHistory[found.LocHistory.length-1]["loc"] != location){
                found.LocHistory.push({"loc":location, "time":_now});
            }
        }
    }
    _update_path(deviceid, path){
        var found = _.find(this.Sessions, {DeviceID:deviceid});
        if(found){
            found.CurrentPath = path;
        }
    }
    _update_ruleset(){
        var self = this;
        prefclient.refresh_ruleset(function(data){
            if(data){
                self.rules = [];
                var all_ids = [];
                for(var rule in data["results"]){
                    var _rule = data["results"][rule];
                    var entry = {
                        "ant":_rule["ant"][0], //see below
                        "con":_rule["con"][0], //just using the first one for now, TODO fork this here
                        "confidence":_rule["confidence"]
                    };
                    all_ids.push(_rule["ant"][0]);
                    self.rules.push(entry);
                }
                self.rules = _.sortBy(self.rules, "confidence");
                var uniques = _.uniq(all_ids);
                //console.log("Unique ids in pref ruleset:");
                //console.log(uniques);
                console.log(self.rules);
            }
        });
    }
};

class PrefEngineWrapper{
    constructor(host){
        this.Host = host;
        console.log("Initializing preference engine wrapper...");
        this.pref_oauth = new ClientOAuth2({
            clientId: prefengid,
            clientSecret: prefengsecret,
            accessTokenUri: '',
            authorizationUri: '',
            redirectUri: '',
            scopes: []
        });
    }
    _turn_in_pref(cb){
        //send a single preference to get a set of consequents.
        request.get(
            this.Host,
            function (error, response, body) {
                cb();
            }
        );
    }
}

module.exports.SessionDictionary = SessionDictionary;
module.exports.DeviceSession = DeviceSession;