const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const static = require('node-static');


const directory = ('watched');


/* empty folder before starting */
fs.readdir(directory, (err, files) => {
    if (err) throw err;
    for (const file of files) {
        fs.unlink(path.join(directory, file), err => {
            if (err) throw err;
        });
    }
});


const files = new static.Server('./watched/');

require('http').createServer(function (request, response) {
    request.addListener('end', function () {
        files.serve(request, response);
    }).resume();
}).listen(16200);



chokidar.watch('./watched').on('add', (event, dpath) => {
    console.log(event);
    var fileName = path.basename('/'+event);
    if(path.extname(fileName) !== ".torrent"){
        console.log(`Invalid file detected: "${fileName}". Deleting it from the watched folder!`);
        fs.unlink(path.join(directory, fileName), err => {
            if (err) throw err;
        })
    }else{

    }
});

