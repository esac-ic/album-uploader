const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const sharp = require("sharp");
const request = require("request");

const MAX_FILES = 20; // Limit the batch size to this number of files.
let _url;
let _apiKey;
let _batchSize;

module.exports = class Uploader {
    constructor(url, apiKey, batchSize) {
        _url = url;
        _apiKey = apiKey;
        _batchSize = batchSize * 900000;
    }

    uploadAlbum (progress, folder) {
        let info = JSON.parse(fs.readFileSync(path.join(folder, "info.json"), 'utf8'));

        // Give warning if name truncated.
        if (info.name.length >= 250) {
            info.name = info.name.substring(0, 250);
            console.warn(chalk.white.bgRed.bold("Warning album name truncated, longer than 250 characters: " + info.name + "..."));
        }

        // Give warning if description truncated.
        if (info.description.length >= 250) {
            info.description = info.description.substring(0, 250);
            console.warn(chalk.white.bgRed.bold("Warning album description truncated, longer than 250 characters: " + info.description + "..."));
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
            }).reverse(); // We reverse the array, so we can use pop later which is more efficient :)

            // Store the progress information inside the progress bar object.
            progress.current = 0;
            progress.amount = files.length;
            processPhotos(progress, files, info);
        });
    }
};

/**
 * Divides the thumbnails and photos in batches based on the max post size and max amount of files per request.
 * @param thumbnails
 * @param photos
 * @returns {Array} of objects, where each object has a property {@code thumbnails} and {@code photos}, and each
 *          element in the array represents a batch.
 */
function divideInBatches(thumbnails, photos) {
    let batches = [];
    let size = 0;
    let amount = 0;
    let i = photos.length;

    while (i > 0) {
        i--;

        let thumbnail = thumbnails.pop(); // The array was reversed, so we can pop from the end :)
        let photo = photos.pop();
        let combiSize = thumbnail.value.length + photo.value.length;

        if (batches.length === 0 || size + combiSize > _batchSize || amount + 2 > MAX_FILES) {
            size = combiSize;
            amount = 2;
            batches.push({
                thumbnails: [thumbnail],
                photos: [photo],
            });
        } else {
            size += combiSize;
            amount += 2;
            batches[batches.length - 1].thumbnails.push(thumbnail);
            batches[batches.length - 1].photos.push(photo);
        }
    }

    return batches;
}

/**
 * First creates thumbnails and compresses all photos, then divides them into batches and creates an api request for
 * each batch.
 * @param progress The progress bar.
 * @param files The photo files to process.
 * @param info Album info object.
 */
function processPhotos(progress, files, info){
    Promise.all(files.map(resizeThumbnail)).then(thumbnails => {
        Promise.all(files.map(downscalePhoto, {progress: progress})).then(photos => {
            let batches = divideInBatches(thumbnails, photos);
            let first = batches.shift(); // Get and remove the first batch.

            addAlbum(first.thumbnails, first.photos, info).then(albumId => {
                batches.forEach(item => {
                    addPhotoToAlbum(albumId, item.thumbnails, item.photos);
                })
            });
        })
    });
}

/**
 * Increment a progress bar by one.
 * @param progress The progress bar to increment.
 */
function increment(progress) {
    let units = Math.round(++progress.current / progress.amount * 50);

    progress('[' + chalk.yellow('='.repeat(units) + ' '.repeat(50 - units)) + '] '
        + chalk.blue(progress.current + '/' + progress.amount));
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
                increment(this.progress);
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

/**
 * API POST request to backend to add one album.
 * @param thumbnails
 * @param photos
 * @param info Album info object, containing {@code name}, {@code description} and {@code date} properties.
 * @returns {Promise<Number>} the album id.
 */
function addAlbum(thumbnails, photos, info) {
    return new Promise(function (resolve, reject) {
        const formData = {
            title: info.name,
            description: info.description,
            captureDate: info.date,
            "thumbnails[]": thumbnails,
            "photos[]": photos,
            api_token: _apiKey,
        };

        request.post({
            url: _url,
            formData:
            formData,
            headers: {
                'Accept': 'application/json'
            }}, (err, response, body) => {
                if (err || response.statusCode !== 200) {
                    reject();
                    return console.error('upload failed:', err ? err : body);
                }
                resolve(body);
            }
        );
    });
}

/**
 * API POST request to backend to add photos to an album.
 * @param albumId
 * @param thumbnails
 * @param photos
 * @returns {Promise<void>} Resolves on success.
 */
function addPhotoToAlbum(albumId, thumbnails, photos){
    return new Promise(function (resolve, reject) {
        const formData = {
            "thumbnails[]": thumbnails,
            "photos[]": photos,
            api_token: _apiKey,
        };

        const url = _url + "/" + albumId;

        request.post({
            url: url,
            formData: formData,
            headers: {
                'Accept': 'application/json'
            }}, (err, response, body) => {
                if (err) {
                    reject();
                    return console.error('upload failed:', err ? err : body);
                }
                resolve();
            }
        );
    });
}
