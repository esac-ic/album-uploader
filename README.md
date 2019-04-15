# album-uploader
Simple utility to upload all existing photo albums to the new esac.nl album storage

## Requirements
* NodeJS
* NPM
    - NPM dependencies are defined in the `package.json`

Also make sure the [feature/photoalbums_api](https://github.com/esac-ic/esac.nl/tree/feature/photoalbums_api) branch is active (or merged into master).

## Installation instructions
* npm install

## Run instructions
Make sure each album folder contains only images and one `info.json` file, structed as follows: 

```json
{
    "name": "Album name",
    "description": "Nice description",
    "date": "YYYY-MM-DD"
}

```

Then run `node index.js`
