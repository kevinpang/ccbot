const clashApi = require('clash-of-clans-api');
const logger = require('../logger.js');

try {
  var auth = require("../auth.json");
} catch (e) {
  logger.error("Please create an auth.json file like auth.json.example " + e);
  process.exit();
}

let client = clashApi({
  token: auth.clashApiToken || 'test'
});

// Returns a future for the current war for the specific clan.
exports.getCurrentWar = function(clanTag) {
  if (!clanTag.startsWith('#')) {
    clanTag = `#${clanTag}`;
  }
  logger.debug(`Fetching current war for ${clanTag}`);

  return client.clanCurrentWarByTag(clanTag).
      then(currentWar => {
        logger.debug(`Current war for ${clanTag}: ${JSON.stringify(currentWar)}`);
        return currentWar;
        /* Test code */
        /*
        var fs = require('fs');
        var obj = JSON.parse(fs.readFileSync('./sample_data/clash_of_clans_api_ended_war.json', 'utf8'));
        return obj;
        */
      });
};

// Returns attacks since the specified attack.
exports.getNewAttacks = function(warData, oldWarData) {
  lastAttack = getLastAttack_(oldWarData);
  let newAttacks = [];
  
  for (let i = 0; i < warData.clan.members.length; i++) {
    let member = warData.clan.members[i];
    if (member.attacks) {
      for (let j = 0; j < member.attacks.length; j++) {
        let attack = member.attacks[j];
        if (!lastAttack || lastAttack.order < attack.order) {
          newAttacks.push(attack);
        }
      }
    }
  }

  return newAttacks;
};

// Returns member of war (of either clan) that matches the specified player tag.
exports.getMember = function(warData, playerTag) {
  for (let i = 0; i < warData.clan.members.length; i++) {
    let member = warData.clan.members[i];
    if (member.tag == playerTag) {
      return member;
    }
  }

  for (let i = 0; i < warData.opponent.members.length; i++) {
    let member = warData.opponent.members[i];
    if (member.tag == playerTag) {
      return member;
    }
  }
};

// Returns the last attack in the specified war data.
let getLastAttack_ = function(warData) {
  let lastAttack = null;

  for (let i = 0; i < warData.clan.members.length; i++) {
    let member = warData.clan.members[i];
    if (member.attacks) {
      for (let j = 0; j < member.attacks.length; j++) {
        let attack = member.attacks[j];
        if (lastAttack == null || lastAttack.order < attack.order) {
          lastAttack = attack;
        }
      }
    }
  }

  return lastAttack;
};
