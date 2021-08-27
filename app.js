const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const os = require('os');
const FormData = require('form-data');
const { FreeboxRegister, Freebox } = require("freebox");

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

if(!fs.existsSync("./fbx.json")){
    async function main() {
        const freeboxRegister = new FreeboxRegister({
            app_id: "fbx.dl-blackhole",
            app_name: "Freebox Download Blackhole",
            app_version: "1.0.0",
            device_name: os.hostname(),
        });

        // Obtaining an app_token & everything you need
        // following the guide at https://dev.freebox.fr/sdk/os/login/
        const access = await freeboxRegister.register();
    }
    main().catch(err => console.error(err));
}else {
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

        chokidar.watch('./watched').on('add', (event, dpath) => {
            console.log("New file detected: "+event);
            var fileName = path.basename('/' + event);
            if (path.extname(fileName) !== ".torrent") {
                console.log(`Invalid file detected: "${fileName}". Deleting it from the watched folder!`);
                fs.unlink(path.join(directory, fileName), err => {
                    if (err) throw err;
                })
            } else {
                const formData = new FormData();
                let downDir = '/Freebox/Films';
                let buff = new Buffer(downDir);
                let b64Dir = buff.toString('base64');
                formData.append('download_dir', b64Dir);
                formData.append('download_file', fs.createReadStream(path.join(directory, fileName)));
                freebox.request({
                    method: 'post',
                    url: 'downloads/add',
                    data: formData,
                    headers: formData.getHeaders()
                }).then(function(response) {
                    console.log(response.data.success);
                    if(response.data.success === true){
                        console.log("Download added successfully to the Freebox at this path: "+downDir);
                        fs.unlink(path.join(directory, fileName), err => {
                            if (err) throw err;
                        })
                    }else{
                        console.error("An error occured while adding the torrent to the Freebox: "+response.data.error_code+" ("+response.data.msg+")");
                    }
                }).catch(err => console.error(err));

            }
        });

        // Close the current session
        // https://dev.freebox.fr/sdk/os/login/#closing-the-current-session
    }

    main().catch(err => console.error(err));
}

