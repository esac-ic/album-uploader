const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const sharp = require("sharp");
const request = require("request");

let _url;
let _apiKey;

module.exports = class Uploader {
    constructor(url, apiKey) {
        _url = url;
        _apiKey = apiKey;
    }

    uploadAlbum (folder) {
        let info = JSON.parse(fs.readFileSync(path.join(folder, "info.json"), 'utf8'));

        // Give warning if name truncated.
        if (info.name.length >= 250) {
            info.name = info.name.substring(0, 250);
            console.warn(chalk.yellow("Warning album name truncated, longer than 250 characters: " + info.name + "..."));
        }

        // Give warning if description truncated.
        if (info.description.length >= 250) {
            info.description = info.description.substring(0, 250);
            console.warn(chalk.yellow("Warning album description truncated, longer than 250 characters: " + info.description + "..."));
        }

        fs.readdir(folder, (err, files) => {
            // Detect all folders in the base folder.
            files = files.filter(file => {
                // Filter out the info.json file.
                return file !== "info.json";
            }).map(file => {
                // For each filename, read the image data.
                return {
                    value: fs.readFileSync(path.join(folder, file)),
                    filename: file,
                };
            });

            processPhotos(files, info);
        });
    }
};

// TODO upload all in one api request, if post size allows.
function processPhotos(files, info){
    let first = files.shift();

    resizeThumbnail(first).then(firstThumbnail => {
        downscalePhoto(first).then(firstPhoto => {
            addAlbum(firstThumbnail, firstPhoto, info).then(albumId => {
                files.forEach(file => {
                    resizeThumbnail(file).then(thumbnail => {
                        downscalePhoto(file).then(photo => {
                            addPhotoToAlbum(albumId, thumbnail, photo);
                        })
                    })
                });
            });
        })
    });
}


/**
 * Convert the image to JPEG and apply some compression.
 * @param file Object, with in property {@code file.value } the file to compress, and in property {@code file.filename}
 * the filename.
 * @returns {Promise<Object>} image with options, as required by FormData.
 */
function downscalePhoto(file) {
    return new Promise((resolve, reject) => {
        sharp(file.value)
            .jpeg({
                quality: 50,
            })
            .toBuffer()
            .then(data => {
                resolve({
                    value: data,
                    options: {
                        filename: file.filename,
                        contentType: 'image/jpeg'
                    }
                });
            });
    });
}

/**
 * Crop the image and convert it to JPEG.
 * @param file Object, with in property {@code file.value } the file to compress, and in property {@code file.filename}
 * the filename.
 * @returns {Promise<Object>} image with options, as required by FormData.
 */
function resizeThumbnail(file) {
    return new Promise((resolve, reject) => {
        sharp(file.value)
            .resize(354, 354)
            .jpeg()
            .toBuffer()
            .then(data => {
                resolve({
                    value: data,
                    options: {
                    filename: file.filename,
                        contentType: 'image/jpeg'
                }
                });
            });
    });
}

//Api Post request to backend to add one album.
//thumbnail: thumbnail of photo that will be uploaded
//photo: photo that will be uploaded
//albumname: name of album that will be created
//albumdescription: description of album that will be created
//captureDate: Capture date of the photos
//fileIndex: fileIndex of current photo (This is given to ensure to reload after last photo)
function addAlbum(thumbnail, photo, info) {
    // TODO use api endpoint instead, with new auth.
    return new Promise(function (resolve, reject) {
        const formData = {
            title: info.name,
            description: info.description,
            captureDate: info.date,
            "thumbnails[]": thumbnail,
            "photos[]": photo,
            api_token: _apiKey,
        };
        request.post({url: _url, formData: formData, headers: {
            'Accept': 'application/json'
            }}, function onResponse(err, httpResponse, body) {
            console.log(body);
            if (err) {
                // TODO
                return console.error('upload failed:', err);
            }
            resolve(body);
        });
    });
}

//Api Post request to backend to add a photo to an album.
//thumbnail: thumbnail of photo that will be uploaded
//photo: photo that will be uploaded
//fileIndex: fileIndex of current photo (This is given to ensure to reload after last photo)
function addPhotoToAlbum(albumId, thumbnail, photo){
    return new Promise(function (resolve, reject) {
        const formData = {
            "thumbnails[]": thumbnail,
            "photos[]": photo,
            api_token: _apiKey,
        };

        const url = _url + "/" + albumId;

        request.post({url: url, formData: formData, headers: {
                'Accept': 'application/json'
            }}, function onResponse(err, httpResponse, body) {
            console.log(body);
            if (err) {
                // TODO
                return console.error('upload failed:', err);
            }
            resolve();
        });
    });
}
