/* Javascript */

view.loader = async ()=>{

    const transports = await dbApi.db.messages.transport.search() ;
    const sendMail = {} ;

    return {
        transports,
        sendMail
    }
}

view.sendMessage = async ()=>{
    const parameters = {
        from: view.data.sendMail.from,
        to: view.data.sendMail.to,
        subject: view.data.sendMail.subject,
        text: view.data.sendMail.text
    } ;
    if(view.data.sendMail.file){
        const file = /** @type {HTMLInputElement} */ (view.getElementById("attachFile")).files[0];
        parameters.attachments = [
            {
                filename: file.name,
                path: await fileToDataUrl(file)
            }
        ]
    }
    await dbApi.db.messages.message.create({
        transport: view.data.sendMail.transport,
        parameters: parameters
    })

    view.data.sendMail = {} ;
    view.closePopup() ;
}

function fileToDataUrl(file){
    const reader = new FileReader();
    return new Promise((resolve, reject)=>{

        // Set up the FileReader onload event handler
        reader.onload = function(event) {
            // The result attribute contains the data as a data URL
            const dataURL = event.target.result;
            resolve(dataURL) ;
        };
        
        // Set up error handler
        reader.onerror = function() {
            reject("Error reading file")
        };
        
        // Read the file as a data URL
        reader.readAsDataURL(file);
    })
}
