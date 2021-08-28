const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const os = require('os');
const FormData = require('form-data');
const { FreeboxRegister, Freebox } = require("freebox");
let conf;

/* create a config file based on the example at first start */
if(!fs.existsSync("./config.json")){
    fs.copyFile('config.example.json', 'config.json', function (err){
        if (err) throw err;
        console.log("Creating default config.json file. You should probably take a look at it to set your watched directories.");
        conf = require('./config.json');
        initFolders();
    })
}else{
    conf = require('./config.json');
    initFolders();
}


/* if the fbx auth info file isn't found, begin the pairing process */
if(!fs.existsSync("./fbx.json")){
    async function main() {
        const freeboxRegister = new FreeboxRegister({
            app_id: "fbx.dl-blackhole",
            app_name: "Freebox Download Blackhole",
            app_version: "1.0.0",
            device_name: os.hostname(),
        });

        const access = await freeboxRegister.register();
        const fbxJson = JSON.stringify(access);
        fs.writeFile("fbx.json", fbxJson, 'utf8', function (err) {
            if (err) {
                console.log("An error occured while writing JSON object to file.");
                throw err;
            }
            console.log("JSON file containing Freebox authentication informations has been saved.");
        });
    }
    main().catch(err => console.error(err));

}else{
    const fbxInfo = require('./fbx.json');
    async function main() {
        const freebox = new Freebox({
            app_token: fbxInfo.app_token,
            app_id: fbxInfo.app_id,
            api_domain: fbxInfo.api_domain,
            https_port: fbxInfo.https_port,
            api_base_url: fbxInfo.api_base_url,
            api_version: fbxInfo.api_version,
        });

        // Open a session
        // https://dev.freebox.fr/sdk/os/login/
        await freebox.login();
        conf.forEach(function(folder){
            chokidar.watch(folder.watchedDir).on('add', (event, dpath) => {
                console.log("New file detected: "+event);
                let fileName = path.basename('/' + event);
                if (path.extname(fileName) !== ".torrent") {
                    console.log(`Invalid file detected: "${fileName}". Deleting it from the watched folder!`);
                    fs.unlink(path.join(folder.watchedDir, fileName), err => {
                        if (err) throw err;
                    })
                } else {
                    const formData = new FormData();
                    let downDir = folder.targetDir;
                    let buff = new Buffer(downDir);
                    let b64Dir = buff.toString('base64');
                    formData.append('download_dir', b64Dir);
                    formData.append('download_file', fs.createReadStream(path.join(folder.watchedDir, fileName)));
                    freebox.request({
                        method: 'post',
                        url: 'downloads/add',
                        data: formData,
                        headers: formData.getHeaders()
                    }).then(function(response) {
                        if(response.data.success === true){
                            console.log("Download added successfully to the Freebox at this path: "+downDir);
                            fs.unlink(path.join(folder.watchedDir, fileName), err => {
                                if (err) throw err;
                            });
                        }else{
                            console.error(`An error occured while adding the torrent to the Freebox: ${response.data.error_code} (${response.data.msg})`);
                            fs.unlink(path.join(folder.watchedDir, fileName), err => {
                                if (err) throw err;
                            });
                        }
                    }).catch(err => console.error(err));

                }
            });
        });

        // Close the current session
        // https://dev.freebox.fr/sdk/os/login/#closing-the-current-session

        process.on('SIGTERM', () => {
            console.info('Closing Freebox session.');
            freebox.logout();
            process.exit(0);
        });

        process.on('SIGINT', () => {
            console.info('Closing Freebox session.');
            freebox.logout();
            process.exit(0);
        });
    }

    main().catch(err => console.error(err));
}

function initFolders(){
    /* empty watched folders before starting */
    conf.forEach(function (folder){
        if(!fs.existsSync(folder.watchedDir)){
            fs.mkdir(path.join(__dirname, folder.watchedDir), {recursive: true}, function(err){
                if (err) throw err;
                console.log(`Watched directory "${folder.watchedDir}" did not exist, created it for you.`)
            })
        }else {
            fs.readdir(folder.watchedDir, (err, files) => {
                if (err) throw err;
                for (const file of files) {
                    fs.unlink(path.join(folder.watchedDir, file), err => {
                        if (err) console.error(err);
                    });
                }
            });
        }
    });
}
