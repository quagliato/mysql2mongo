#mysql2mongo

## What does it do?

It imports MySQL tables into MongoDB collections.

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

-----

## Get in touch

Got any doubts or suggestions? You can contact me at 
[eduardo AT quagliato DOTme](mailto:eduardo@quagliato.me)