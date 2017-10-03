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

/**
 * Returns the war summary message.
 */
exports.getWarSummaryMessage = function(warData) {
  let clanName = warData.clan.name;
  let clanTag = warData.clan.tag;
  let enemyName = warData.opponent.name;
  let enemyClanTag = warData.opponent.tag;
  let warSize = warData.teamSize;
  let numStars = warData.clan.stars;
  let numEnemyStars = warData.opponent.stars;
  let percentage = warData.clan.destructionPercentage;
  let enemyPercentage = warData.opponent.destructionPercentage;
  let numAttacks = warData.clan.attacks;
  let numEnemyAttacks = warData.opponent.attacks;

  let playerTagToThLevelMap = getPlayerTagToThLevelMap_(warData);
  let clanStatistics = getStatisticsForClan_(warData.clan, playerTagToThLevelMap);
  let enemyStatistics = getStatisticsForClan_(warData.opponent, playerTagToThLevelMap);

  // Format current war statistics
  if (warData.state == 'notInWar') {
    return 'Currently not in a war';
  }

  let message = '```\n';
  message += `${clanName} (${clanTag}) vs ${enemyName} (${enemyClanTag})\n`;
  message += `Status: ${getWarTimeMessage_(warData) || 'Unknown'}\n`;
  message += `Stars: ${numStars} - ${numEnemyStars}\n`;
  message += `Percentage: ${percentage}% - ${enemyPercentage}%\n\n`;
  message += `Attacks: ${numAttacks}/${warSize * 2} - ${numEnemyAttacks}/${warSize * 2}\n`;
  message += `Breakdown: ${clanStatistics.numTh11s}/${clanStatistics.numTh10s}/${clanStatistics.numTh9s} - ` +
      `${enemyStatistics.numTh11s}/${enemyStatistics.numTh10s}/${enemyStatistics.numTh9s}\n`;
  message += `Attacks left: ${clanStatistics.numTh11AttacksLeft}/${clanStatistics.numTh10AttacksLeft}/${clanStatistics.numTh9AttacksLeft} - ` +
      `${enemyStatistics.numTh11AttacksLeft}/${enemyStatistics.numTh10AttacksLeft}/${enemyStatistics.numTh9AttacksLeft}\n\n`;
  message += `11v11 ?**: ${formatThvTh_(clanStatistics.num11v11TwoStars, clanStatistics.num11v11Attempts)} - ` +
      `${formatThvTh_(enemyStatistics.num11v11TwoStars, enemyStatistics.num11v11Attempts)}\n`;
  message += `10v10 ***: ${formatThvTh_(clanStatistics.num10v10ThreeStars, clanStatistics.num10v10Attempts)} - ` +
      `${formatThvTh_(enemyStatistics.num10v10ThreeStars, enemyStatistics.num10v10Attempts)}\n`;
  message += `9v9   ***: ${formatThvTh_(clanStatistics.num9v9ThreeStars, clanStatistics.num9v9Attempts)} - ` +
      `${formatThvTh_(enemyStatistics.num9v9ThreeStars, enemyStatistics.num9v9Attempts)}\n`;
  message += `11v10 ***: ${formatThvTh_(clanStatistics.num11v10ThreeStars, clanStatistics.num11v10Attempts)} - ` +
      `${formatThvTh_(enemyStatistics.num11v10ThreeStars, enemyStatistics.num11v10Attempts)}\n`;
  message += `10v9  ***: ${formatThvTh_(clanStatistics.num10v9ThreeStars, clanStatistics.num10v9Attempts)} - ` +
      `${formatThvTh_(enemyStatistics.num10v9ThreeStars, enemyStatistics.num10v9Attempts)}\n`;
  message += `10v11 \?**: ${formatThvTh_(clanStatistics.num10v11TwoStars, clanStatistics.num10v11Attempts)} - ` +
      `${formatThvTh_(enemyStatistics.num10v11TwoStars, enemyStatistics.num10v11Attempts)}\n`;
  message += `9v10  \?**: ${formatThvTh_(clanStatistics.num9v10TwoStars, clanStatistics.num9v10Attempts)} - ` +
      `${formatThvTh_(enemyStatistics.num9v10TwoStars, enemyStatistics.num9v10Attempts)}`;

  message += '```';

  return message;
};

/**
 * Parses time returned by Clash of Clans API into Date object.
 * 
 * @param {string} time the time returned by Clash of Clans API (e.g. "20170921T021623.000Z").
 */
exports.parseClashTime = (time) => {
  let year = time.substring(0, 4);
  let month = time.substring(4, 6);
  let day = time.substring(6, 8);
  let hour = time.substring(9, 11);
  let minute = time.substring(11, 13);
  let second = time.substring(13, 15);
  return new Date(`${year}-${month}-${day} ${hour}:${minute}:${second} +0000`);
};

/**
 * Returns war time message (e.g. "War starts in 2h35m", "War ends in "5h38m", "War has ended""),
 * or null if currently not in a war.
 */
let getWarTimeMessage_ = (warData) => {
  switch (warData.state) {
    case 'warEnded':
      return 'War has ended.';
    case 'preparation':
      let startDate = exports.parseClashTime(warData.startTime);
      return `War starts in ${getTimeDiffMessage_(startDate)}`;
      break;
    case 'inWar':
      let endDate = exports.parseClashTime(warData.endTime);
      return `War ends in ${getTimeDiffMessage_(endDate)}`;
    default:
      return null;
  }
};

/**
 * Returns a formatted message expressing how much time it will be until a certain point in time
 * (e.g. "1h35m").
 * 
 * @param {Date} target The target date to measure the time between.
 */
let getTimeDiffMessage_ = (target) => {
  let now = new Date();
  let timeDiff = target - now;
  let minutesDiff = timeDiff / 1000 / 60;
  return `${Math.floor(minutesDiff / 60)}h${Math.floor(minutesDiff % 60)}m`;
}

let formatThvTh_ = function(numSuccess, numAttempts) {
  return `${numSuccess}/${numAttempts}` + (numAttempts > 0 ? ` (${Math.floor(numSuccess/numAttempts*100)}%)` : '');
};

/**
 * Returns the current war statistics for the given clan.
 * 
 * @param {*} clan either the clan or opponent JSON object returned by the Clash of Clans API
 */
let getStatisticsForClan_ = function(clan, playerTagToThLevelMap) {
  let statistics = {
    'numTh9s': 0,
    'numTh10s': 0,
    'numTh11s': 0,
    'numTh11AttacksLeft': 0,
    'numTh10AttacksLeft': 0,
    'numTh9AttacksLeft': 0,
    'num11v11ThreeStars': 0,
    'num11v11TwoStars': 0,
    'num11v11Attempts': 0,
    'num10v10ThreeStars': 0,
    'num10v10Attempts': 0,
    'num9v9ThreeStars': 0,
    'num9v9Attempts': 0,
    'num11v10ThreeStars': 0,
    'num11v10Attempts': 0,
    'num10v9ThreeStars': 0,
    'num10v9Attempts': 0,
    'num10v11TwoStars': 0,
    'num10v11Attempts': 0,
    'num9v10TwoStars': 0,
    'num9v10Attempts': 0
  };

  for (let i = 0; i < clan.members.length; i++) {
    let member = clan.members[i];   
    switch (member.townhallLevel) {
      case 9:
        statistics.numTh9s++;
        if (member.attacks) {
          statistics.numTh9AttacksLeft += 2 - member.attacks.length;

          for (let j = 0; j < member.attacks.length; j++) {
            let attack = member.attacks[j];
            let defenderThLevel = playerTagToThLevelMap[attack.defenderTag];
            switch (defenderThLevel) {
              case 9:
                statistics.num9v9Attempts++;
                if (attack.stars == 3) {
                  statistics.num9v9ThreeStars++;
                }
                break;
              case 10:
                statistics.num9v10Attempts++;
                if (attack.stars >= 2) {
                  statistics.num9v10TwoStars++;
                }
                break;
            }
          }
        } else {
          statistics.numTh9AttacksLeft += 2;
        }
        break;
      case 10:
        statistics.numTh10s++;
        if (member.attacks) {
          statistics.numTh10AttacksLeft += 2 - member.attacks.length;

          for (let j = 0; j < member.attacks.length; j++) {
            let attack = member.attacks[j];
            let defenderThLevel = playerTagToThLevelMap[attack.defenderTag];
            switch (defenderThLevel) {
              case 9:
                statistics.num10v9Attempts++;
                if (attack.stars == 3) {
                  statistics.num10v9ThreeStars++;
                }
                break;
              case 10:
                statistics.num10v10Attempts++;
                if (attack.stars == 3) {
                  statistics.num10v10ThreeStars++;
                }
                break;
              case 11:
                statistics.num10v11Attempts++;
                if (attack.stars >= 2) {
                  statistics.num10v11TwoStars++;
                }
                break;
            }
          }
        } else {
          statistics.numTh10AttacksLeft += 2;
        }
        break;
      case 11:
        statistics.numTh11s++;
        if (member.attacks) {
          statistics.numTh11AttacksLeft += 2 - member.attacks.length;

          for (let j = 0; j < member.attacks.length; j++) {
            let attack = member.attacks[j];
            let defenderThLevel = playerTagToThLevelMap[attack.defenderTag];
            switch (defenderThLevel) {
              case 10:
                statistics.num11v10Attempts++;
                if (attack.stars == 3) {
                  statistics.num11v10ThreeStars++;
                }
                break;
              case 11:
                statistics.num11v11Attempts++;
                if (attack.stars >= 2) {
                  statistics.num11v11TwoStars++;
                  if (attack.stars == 3) {
                    statistics.num11v11ThreeStars++;
                  }
                }
                break;
            }
          }
        } else {
          statistics.numTh11AttacksLeft += 2;
        }
        break;
    }
  }

  return statistics;
}

/**
 * Returns a map of player tag to th level given the current war returned by Clash of Clans API.
 */
let getPlayerTagToThLevelMap_ = function(warData) {
  let map = {};

  for (let i = 0; i < warData.clan.members.length; i++) {
    let member = warData.clan.members[i];
    map[member.tag] = member.townhallLevel;
  }

  for (let i = 0; i < warData.opponent.members.length; i++) {
    let member = warData.opponent.members[i];
    map[member.tag] = member.townhallLevel;
  }

  return map;
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
