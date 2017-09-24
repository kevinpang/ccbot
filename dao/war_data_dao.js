const storage = require('node-persist');

// Required to call this before any operations can be done with node-persist.
storage.initSync({
  dir: 'node_persist/war_data'
});

/**
 * Get latest stored war data from Clash of Clans API for the specified clan.
 */
exports.getWarData = function(clanTag, preparationStartTime) {
  return storage.getItemSync(getKey(clanTag, preparationStartTime));
};

/**
 * Saves Clash of Clans API war data for the specified clan.
 */
exports.saveWarData = function(clanTag, warData) {
  storage.setItemSync(getKey(clanTag, warData.preparationStartTime), warData);
};

let getKey = function(clanTag, preparationStartTime) {
  return `${clanTag}-${preparationStartTime}`;
}
