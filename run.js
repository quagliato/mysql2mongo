// mysql2mongo
// Author: Eduardo Quagliato <eduardo@quagliato.me>
// Description: It imports the MySQL records to a Mongo-based database

// Dependencies
const async                  = require ('async');
const fs                     = require ('fs');
const moment                 = require ('moment');
const mongodb                = require ('mongodb');
const mongoskin              = require ('mongoskin');
const SPAWL                  = require ('spawl');
const SPAWLMariaDBConnector  = require ('spawl-mariadb');

/*
 * 2017-02-27, Curitiba - Brazil
 * Author: Eduardo Quagliato<eduardo@quagliato.me>
 * Description: Simple log engine
 */
function log (message, level) {
  if (level === undefined) level = 'INFO';
  message = `${moment().format('YYYY-MM-DD HH:mm:ss.SSS Z')} [${level}] ${message}`;
  console.log(message);
}

/*
 * 2017-02-27, Curitiba - Brazil
 * Author: Eduardo Quagliato<eduardo@quagliato.me>
 * Description: Error treatment
 */
function throwError (message) {
  log(message, 'CRITICAL');
  const e = new Error(message);
  console.log(e);
  process.exit(1);
}

// Gets the environment from the system
let configEnv = null;
if (process.env.MYSQL2MONGO_ENV) configEnv = process.env.MYSQL2MONGO_ENV;

// Composes the configuration file name.
const configFile = '_config/config' + (configEnv !== null ? `-${configEnv}` : '') + '.json';

// Tries to read the configuration file to see if it's really there
try {
  fs.readFileSync(configFile);
} catch (e) {
  throwError('Config file not found or can\'t be opened.');
}

// Imports the configuration file
const config = require (`./${configFile}`);

// Required properties on configuration file
const requiredConfigSettings = {
  'MYSQL_SETTINGS': [
    'DB_HOST',
    'DB_USER',
    'DB_NAME',
    'DB_PASS'
  ],
  'MONGODB_SETTINGS': [
    'DB_HOST',
    'DB_PORT',
    'DB_NAME'
  ],
  'WHAT_2_IMPORT': true
};


// Validates required properties on configuration file
for (let key in requiredConfigSettings) {
  if (!config.hasOwnProperty(key) || config[key] === null || config[key] === undefined) {
    throwError(`Required configuration for ${key} isn't available in the file.`);
  } 

  if (requiredConfigSettings[key] !== true) {
    for (let i = 0; i < requiredConfigSettings[key].length; i++) {
      const lowerKey = requiredConfigSettings[key][i];
      if (!config[key].hasOwnProperty(lowerKey) || config[key][lowerKey] === null || config[key][lowerKey] === undefined) {
        throwError(`Required configuration for ${key}.${lowerKey} isn't available in the file.`);
      } 
    }
  }
}

// Declares database connections
const spawl = new SPAWL(new SPAWLMariaDBConnector(config.MYSQL_SETTINGS, function (message, level) {
  if (level === 'CRITICAL') return log(message, level);
}));
const db = mongoskin.db(`mongodb://${config.MONGODB_SETTINGS.DB_HOST}:${config.MONGODB_SETTINGS.DB_PORT}/${config.MONGODB_SETTINGS.DB_NAME}`, {native_parser:true});

/*
 * 2017-02-27, Curitiba - Brazil
 * Author: Eduardo Quagliato<eduardo@quagliato.me>
 * Description: The definitive try to import MySQL table to MongoDB Collection
 */
function importTable (tableName, collectionName, tableFields, page, pageSize, callback, retry) {
  log(`Importing table ${tableName} to collection ${collectionName} / page ${page}, size: ${pageSize}`);
  if (retry !== undefined) {
    log(`Retry ${retry} of table ${tableName}, page ${page}  (size: ${pageSize})`, 'ERROR');
  }

  if (page === undefined) page = 1;
  if (pageSize === undefined) pageSize = 1000;
  spawl.get(tableName, [], {}, undefined, page, pageSize, function (size, rows) {
    if (size === -1) {
      if (retry === undefined) retry = 0;
      retry += 1;
      return importTable(tableName, collectionName, tableFields, page, pageSize, callback, retry);
    }
    if (size === 0) return callback(undefined);
    const newObjects = [];
    for (let i = 0; i < size; i++) {
      const row = rows[i];
      const newObject = {};
      for (let j = 0; j < tableFields.length; j++) {
        const fieldConfig = tableFields[j];
        if (row[fieldConfig.old_name] !== undefined && row[fieldConfig.old_name] !== null) {
          let value = row[fieldConfig.old_name];
          switch (fieldConfig.type) {
            case 'int': value = parseInt(value); break;
            case 'float': value = parseFloat(value); break;
            case 'date': value = new Date(value); break;
            case 'boolean': value = (value === 'true' || value === true || value === 1 ? true : false); break;
          }

          newObject[fieldConfig.new_name] = value;
          
        } else {
          newObject[fieldConfig.new_name] = null;
        }
      }
      newObject.migrated = new Date();
      newObjects.push(newObject);
    }

    const result = db.collection(collectionName).insertMany(newObjects, function(err, result){
      if (err) {
        if (retry === undefined) retry = 0;
        retry += 1;
        return importTable(tableName, collectionName, tableFields, page, pageSize, callback, retry);
      }

      if (newObjects.length < pageSize) {
        return callback(undefined);
      }

      page += 1;
      return importTable(tableName, collectionName, tableFields, page, pageSize, callback);
    });

  });
}

/*
 * 2017-03-03, Curitiba - Brazil
 * Author: Eduardo Quagliato<eduardo@quagliato.me>
 * Description: The definitive try to import MySQL table to MongoDB Collection
 */
function importTableAsync (tableName, collectionName, tableFields, page, pageSize, callback, retry) {
  log(`Importing table ${tableName} to collection ${collectionName} / page ${page}, size: ${pageSize}`);
  if (retry !== undefined) {
    log(`Retry ${retry} of table ${tableName}, page ${page}  (size: ${pageSize})`, 'ERROR');
  }

  if (page === undefined) page = 1;
  if (pageSize === undefined) pageSize = 1000;
  spawl.get(tableName, [], {}, undefined, page, pageSize, function (size, rows) {
    if (size === -1) {
      if (retry === undefined) retry = 0;
      retry += 1;
      return importTableAsync(tableName, collectionName, tableFields, page, pageSize, callback, retry);
    }
    if (size === 0) return callback(undefined);
    const newObjects = [];
    for (let i = 0; i < size; i++) {
      const row = rows[i];
      const newObject = {};
      for (let j = 0; j < tableFields.length; j++) {
        const fieldConfig = tableFields[j];
        if (row[fieldConfig.old_name] !== undefined && row[fieldConfig.old_name] !== null) {
          let value = row[fieldConfig.old_name];
          switch (fieldConfig.type) {
            case 'int': value = parseInt(value); break;
            case 'float': value = parseFloat(value); break;
            case 'date': value = new Date(value); break;
            case 'boolean': value = (value === 'true' || value === true || value === 1 ? true : false); break;
          }

          newObject[fieldConfig.new_name] = value;
          
        } else {
          newObject[fieldConfig.new_name] = null;
        }
      }
      newObject.migrated = new Date();
      newObjects.push(newObject);
    }

    const result = db.collection(collectionName).insertMany(newObjects, function(err, result){
      if (err) {
        if (retry === undefined) retry = 0;
        retry += 1;
        return importTableAsync(tableName, collectionName, tableFields, page, pageSize, callback, retry);
      }

      if (newObjects.length < pageSize) {
        return callback(undefined, newObjects.length);
      }

      return callback(undefined, pageSize);
    });

  });
}

/*
 * 2017-02-27, Curitiba - Brazil
 * Author: Eduardo Quagliato<eduardo@quagliato.me>
 * Description: The definitive try to load a MongoDB collection paginated
 */
function loadCollection (collectionName, page, pageSize, resultObjects, callback, retry) {
  if (page === undefined) page = 1;
  if (pageSize === undefined) pageSize = 1000;
  if (resultObjects === undefined) resultObjects = {};

  log(`Loading collection ${collectionName} / page ${page}, size: ${pageSize}`);
  if (retry !== undefined) {
    log(`Retry ${retry} of collection ${collectionName}, page ${page}  (size: ${pageSize})`, 'ERROR');
  }

  db.collection(collectionName).find({}).limit(pageSize).skip((page - 1) * pageSize).sort({ migrated: 1}).toArray(function (err, result) {
    if (err) {
      if (retry === undefined) retry = 0;
        retry += 1;
      return loadCollection(collectionName, page, pageSize, resultObjects, callback, retry);
    }

    if (result.length === 0) return callback(undefined, resultObjects);

    for (let i = 0; i < result.length; i++) {
      const row = result[i];
      resultObjects[row.__old_id] = row;
    }

    if (result.length < pageSize) return callback(undefined, resultObjects);
    else return loadCollection(collectionName, (page + 1), pageSize, resultObjects, callback);
  });
};

/*
 * 2017-02-27, Curitiba - Brazil
 * Author: Eduardo Quagliato<eduardo@quagliato.me>
 * Description: It updates cross-reference between collections
 */
function update (search, page, pageSize, callback, retry) {
  if (page === undefined) page = 1 ;
  if (pageSize === undefined) pageSize = 1000;

  log(`Updating collection ${search.collection}, field ${search.new_field} / page ${page}, size: ${pageSize}`);
  if (retry !== undefined) {
    log(`Retry ${retry} of collection ${search.collection}, page ${page}  (size: ${pageSize})`, 'ERROR');
  }

  let generalFields = {
    _id: 1
  };
  generalFields[search.field] = 1;

  db.collection(search.collection).find({}, generalFields).sort({ migrated: 1}).limit(pageSize).skip((page - 1) * pageSize).toArray(function (err, result){
    if (err) {
      console.log(err);
      if (retry === undefined) retry = 0;
      retry += 1;
      return update(search, page, pageSize, callback, retry);
    }

    if (result.length === 0) return callback(undefined);

    let count = 0;

    async.eachLimit(result, 10, function(item, cb) {
      const filter = {};
      filter[search.search_field] = item[search.field];

      const fields = {};
      fields[search.search_new_field] = 1;

      db.collection(search.search_collection).find(filter, fields).toArray(function (err, searchCollectionResult) {
        if (err) return cb(err);

        if (searchCollectionResult.hasOwnProperty('length') && searchCollectionResult.length === 1) searchCollectionResult = searchCollectionResult[0];
        let updateObj = {
          $set: {}
        };

        updateObj['$set'][search.new_field] = mongodb.ObjectId(searchCollectionResult[search.search_new_field]);
      
        db.collection(search.collection).update({ _id: mongodb.ObjectId(item._id)}, updateObj, function (err){
          if (err) return cb(err);
          log(`Updated record ${count} on collection ${search.collection}, field ${search.new_field} / page ${page}, size: ${pageSize}`);
          count += 1;
          cb();
        });
      });
    }, function (err) {
      if (err) {
        console.log(err);
        if (retry === undefined) retry = 0;
        retry += 1;
        return update(search, page, pageSize, callback, retry);
      }

      if (result.length < pageSize) return callback();
      return update(search, (page + 1), pageSize, callback);
    });
  });
};


// MAIN PROCESSING

const what2import = config.WHAT_2_IMPORT

// Iterates the importation configuration
async.eachSeries(what2import, function (importation, callback) {
  // Loads the table mapping
  let tableMappingFile = `_tables/${importation.table_name}.json`;
  if (importation.hasOwnProperty('mapping_file')) {
    tableMappingFile = importation.mapping_file;
  }
  const tableFields = require (`./${tableMappingFile}`);

  // Pagination
  let pageSize = importation.page_size !== undefined ? parseInt(importation.page_size) : 10000;
  let page = importation.page !== undefined ? parseInt(importation.page) : 1; 

  // Synchronic way
  if (importation.sync === true) {
    // Imports the table
    importTable(importation.table_name, importation.collection_name, tableFields, page, pageSize, function (err) {
      if (err) return callback(`Couldn't import table ${importation.table_name}.`);
      callback();
    });

  // Asynchronic way
  } else {
    async.series([
      // Count, if needed
      function (callback2) {
        if (importation.count) return callback2();

        log(`Counting table ${importation.table_name}'s records...`);
        spawl.count(importation.table_name, undefined, function(count){
          if (count === -1) return callback2(`Could not import table ${importation.table_name}.`);
          if (count === 0) return callback2();
          importation.count = count;
          callback2();
        });
      },

      // Interates...
      function (callback2) {
        if (!importation.concurrency) importation.concurrency = 10;
        let totalIterations = (parseInt(importation.count / pageSize) + 1);
        if (page > 1) totalIterations -= page;

        log(`The table ${importation.table_name}'s ${importation.count} records will be imported in ${totalIterations} page(s).`);

        async.timesLimit(totalIterations, importation.concurrency, function (iterationPage, callback3) {
          iterationPage += page;
          importTableAsync(importation.table_name, importation.collection_name, tableFields, iterationPage, pageSize, function (err, processedCount) {
            callback3(err);
          });
        }, function (err, result) {
          return callback2(err);
        });
      }
    ], function (err) {
      return callback(err);
    });
  }

  

}, function (err) {
  if (err) return throwError(err);


  if (!config.REPLACES || config.REPLACES.length === 0) {
    console.log('Process finished.');
    return process.exit(0);
  }

  // Iterates the fields that need to be re-set
  async.eachSeries(config.REPLACES, function(replace, callback){
    // Updates cross-referenced fields between collections
    update(replace, 1, 1000, function(err, result){
      callback(err);
    });
  }, function (err){
    if (err) return throwError(err);
    process.exit(0);
  });
});

// That's all, folks!