#mysql2mongo

## What does it do?

It imports MySQL tables into MongoDB collections.

## How does it do it?

First of all, it uses a mapping file to know which table to import to which 
collection and which column to import to which property of the new document.
Take a looking at *Table mapping* down below.

It imports in batches, so it paginates the requests to MySQL and execute 
concurrent requests.

After importation the next step is replace. The replace engine cross-update
foreign key fields by its new ObjectId in Mongo. So it searches for old id *X* 
from *collection 1* in old id *A* from *collection 2* and replaces new property 
*B* by the value in property *Y* in the document identified by old id *X*, just 
like this:

**Before replace**:

*document 1 (collection 1)*
```json
{
  id: ObjectId("X"),
  collection2_id: "B",
  __old_id: "Y"
}
```

*document 2 (collection 2)*
```json
{
  id: ObjectId("A"),
  collection2_id: "Y",
  __old_id: "B"
}
```

**After replace**:
*document 1 (collection 1)*
```json
{
  id: ObjectId("X"),
  collection2_id: ObjectId("A")
}
```

*document 2 (collection 2)*
```json
{
  id: ObjectId("A"),
  collection2_id: ObjectId("X")
}
```

## Setup

There are 4 levels of configuration and 3 of them are mandatory:

1) Database access (mandatory)
2) What will be imported (mandatory)
3) Table mapping (mandatory)
4) Replaces

I'll break each one down here:

----

### 1. Databases access configuration

First you have to set up the configuration file. You can find an example of it
in `_config/config.json`. In the configuration file you will set up the MySQL 
credentials as well as the MongoDB credentials. Like this:

```json
{
  "MYSQL_SETTINGS": {
    "DB_HOST": "",
    "DB_USER": "",
    "DB_PASS": "",
    "DB_NAME": ""
  },
  "MONGODB_SETTINGS": {
    "DB_HOST": "",
    "DB_PORT": "",
    "DB_NAME": ""
  }
}
```
----

### 2. What will be imported

There's also a `WHAT_2_IMPORT` property which must contain an array of all 
objects representing all the importations that will be done by the script. Each
importation MUST have at least these 3 properties: 

  * table_name: The table in the MySQL Database
  * collection_name: The name of the collection in which the records will be saved
  * mapping_file: A relative path to a file that contains the mapping of which
    table field goes into which collection's object property.

There's also 5 other optional settings for each importation:
  
  * page_size: integer >= 1, the size of the page of the SELECT in the MySQL 
    (default: `10000`)
  * page: integer >= 1, in which page the importation will begin (default: `1`)
  * count: integer >= 1, the scripts counts the registers of that table, if you
    want to skip this process (performance matters etc.), set up here the number
    of records of that table
  * sync: boolean, if `true`, the script will run just 1 SELECT at time 
    (default: `true`)
  * concurrency: if `sync !== true`, it will use these to set up concurrent 
    queries (default: `10`)

Example:

```json
{
  (...)
  "WHAT_2_IMPORT": [
    {
      "table_name": "table1", 
      "collection_name": "collection1",
      "mapping_file": "_tables/table1.json",
      "sync": true
    },
    {
      "table_name": "table2", 
      "collection_name": "collection2",
      "mapping_file": "_tables/table2.json",
      "page_size": 5000,
      "page": 2,
      "count": 40000000,
      "concurrency": 20
    }
  ]
  (...)
}
```
----

### 3. Table mapping

Each mapping contains an array of objects which specifies the origin field in 
the MySQL and the destiny field in the MongoDB, as well as its types, like these:

**table1.json**
```json
[
  {
    "old_name": "id",
    "new_name": "__old_id",
    "type": "int"
  },
  {
    "old_name": "name",
    "new_name": "name",
    "type": "string"
  },
  {
    "old_name": "created",
    "new_name": "dt_created",
    "type": "date"
  }
]
```

**table2.json**
```json
[
  {
    "old_name": "id",
    "new_name": "__old_id",
    "type": "int"
  },
  {
    "old_name": "name",
    "new_name": "name",
    "type": "string"
  },
  {
    "old_name": "created",
    "new_name": "dt_created",
    "type": "date"
  },
  {
    "old_name": "table1_id",
    "new_name": "table1_id",
    "type": "string"
  }
]
```

The accepted types are, for now, these:

* int
* float
* string
* date

Others are on the way, I hope. :)

-----

### 4. Replaces

You can set up, inside the configuration file, a list of replaces for the 
script to run, like this:

```json
{
  (...)
  "REPLACES": [
    {
      "collection": "collection2",
      "field": "table1_id",
      "new_field": "collection1_id",
      "search_collection": "collection1",
      "search_field": "__old_id",
      "search_new_field": "_id"
    }
  ]
}
```

So, in the example above, the script will get the value of property 
`collection2.table1_id` and will search the object that has the same value in `collection1.__old_id`. After that it will create in 
`collection2.collection1_id` with the value of the field 'collection1._id`.

In the root configuration object, you can set up one of the options below:

1. Regular update

In this mode, the replace engine will update every single record, one by one.
To use this way, you have to set it up like this:

```json
{
  "REPLACE_1B1_UPDATE": true
}
```

**Attention**: do not use this mode with a lote of records, it can blow you 
memory.

2. Batch update

This way, the replace is by batch, so it replaces every record that uses the
id X by the id Y. This is the default mode, so you do not need to set it up.

**Attention**: it uses a concurrency of 5 simultaneous process, so overhaul it 
by your own will and take consequences.

3. Batch update by bulk

This is the nuke! It run batch updates, but run the updates by bulks. This can
be tricky, so take care. To set it up, do like this in the root configuration
json:

```json
{
  "REPLACE_BATCH_BULK_UPDATE": true
}
```

**Attention**: it runs 10 operations concurrency with 50 batch updates each in
01 bulk concurrency. Overhaul it by your own will and take consequences.


-----

## Get in touch

Got any doubts or suggestions? You can contact me at 
[eduardo AT quagliato DOTme](mailto:eduardo@quagliato.me)
