const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const sharp = require("sharp");
const request = require("request");

module.exports = {
    uploadAlbum: function(url, folder) {
        let info = JSON.parse(fs.readFileSync(path.join(folder, "info.json"), 'utf8'));

        if (info.name.length >= 250) {
            info.name = info.name.substring(0, 250);
            console.warn(chalk.yellow("Warning album name longer than 250 characters: " + info.name + "..."));
        }

        if (info.description.length >= 250) {
            info.description = info.description.substring(0, 250);
            console.warn(chalk.yellow("Warning album name longer than 250 characters: " + info.description + "..."));
        }

        fs.readdir(folder, (err, files) => {
            files = files.filter(file => {
                return file !== "info.json";
            }).map(file => {
                return fs.readFileSync(path.join(folder, file));
            });

            processPhotos(url, files, info);
        });
    }
};

function processPhotos(url, files, info){
    let first = files.shift();

    resizeThumbnail(first).then(firstThumbnail => {
        downscalePhoto(first).then(firstPhoto => {
            addAlbum(url, firstThumbnail, firstPhoto, info).then(albumId => {
                files.forEach(file => {
                    resizeThumbnail(file).then(thumbnail => {
                        downscalePhoto(file).then(photo => {
                            addPhotoToAlbum(url, albumId, thumbnail, photo);
                        })
                    })
                });
            });
        })
    });
}


//Downscales the original photo to a smaller size
//file: Photo to downscale
function downscalePhoto(file) {
    return sharp(file)
        .jpeg({
            quality: 50,
        })
        .toBuffer();
}

//Resizes the original photo to a thumbnail
//file: Photo to resize
function resizeThumbnail(file) {
    return sharp(file)
        .resize(354, 354)
        .jpeg()
        .toBuffer();
}

//Api Post request to backend to add one album.
//thumbnail: thumbnail of photo that will be uploaded
//photo: photo that will be uploaded
//albumname: name of album that will be created
//albumdescription: description of album that will be created
//captureDate: Capture date of the photos
//fileIndex: fileIndex of current photo (This is given to ensure to reload after last photo)
function addAlbum(url, thumbnail, photo, info) {
    // TODO use api endpoint instead, with new auth.
    return new Promise(function (resolve, reject) {
        const formData = {
            title: info.name,
            description: info.description,
            captureDate: info.date,
            thumnails: [thumbnail],
            photos: [photo],
            /*custom_file: {
                value:  fs.createReadStream('/dev/urandom'),
                options: {
                    filename: 'topsecret.jpg',
                    contentType: 'image/jpeg'
                }
            }*/
        };
        request.post({url: url, formData: formData, headers: {
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
function addPhotoToAlbum(url, albumId, thumbnail, photo){
    // TODO replace ajax.
    return new Promise(function (resolve, reject) {
        var formData = new FormData();
        formData.append('thumbnails[]',thumbnail);
        formData.append('photos[]', photo);

        var type = "POST";
        formData.append("_token", window.Laravel.csrfToken);

        $.ajax({
            url: url + "/" + albumId,
            data: formData,
            type: type,
            contentType: false,
            processData: false,
            success: function (result) {
                resolve();
            },
            error: function (request, error) {
                console.log(arguments);
                alert(" Can't do because: " + error);
            }
        });
    });
}
