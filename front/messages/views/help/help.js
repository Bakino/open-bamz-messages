//Script goes here

// @ts-ignore
const {codeToHtml} = await import('https://esm.sh/shiki@3.0.0')

async function doHighlight(){
    let codeEls = view.querySelectorAll('code[lang]') ;
    for(let codeEl of codeEls){
        if(codeEl.hasAttribute("code-rendered")){
            continue ;
        }
        codeEl.setAttribute("code-rendered", "done") ;
        let lang = codeEl.getAttribute("lang") ; 
        //let comment = Array.prototype.find.call(codeEl.childNodes,n=>n.nodeName === "#comment")
        let comment = Array.prototype.find.call(codeEl.childNodes,n=>n.tagName === "PRE")
        if(comment){
            let codeStr = comment.textContent;//.replace(/^\s*\n+/, "").replace(/\n+\s*$/, "").replace(/!--/g, "<!--").replace(/--!/g, "-->") ; ;
            //let codeStr = codeEl.innerText;

            //remove indentation
            let regexp = new RegExp(/^(\s*)/, "m") ;
            let result = codeStr.match(regexp);
            if(result && result[1]){
                codeStr = codeStr.replace(new RegExp("\n"+result[1]+"", "g"), "\n") ;
            }
            codeStr = codeStr.replaceAll("&dollar;", "$")
            codeStr = codeStr.trim() ;

            let button = document.createElement("BUTTON") ;
            button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-clipboard" viewBox="0 0 16 16">
                <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1z"/>
                <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0z"/>
            </svg>` ;
            button.className = "border p-1 cursor-pointer position-absolute" ;
            button.style.top = "2px"
            button.style.right = "2px"
            button.addEventListener("click", async ()=>{
                await navigator.clipboard.writeText(codeStr);
            });

            codeEl.classList.add("position-relative") ;
            codeEl.classList.add("d-block") ;
            
            if(lang === "json"){
                lang = "javascript" ;
            }
            const codeDiv = document.createElement("DIV") ;
            codeDiv.style.backgroundColor = "#292D3E";
            codeDiv.style.padding = "5px 32px 5px 5px";
            codeDiv.innerHTML = await codeToHtml(codeStr, { lang: lang, theme: 'material-theme-palenight' })
            codeEl.innerHTML = "";
            codeEl.appendChild(button);
            codeEl.appendChild(codeDiv);            
        }
    }
}

view.loader = async ()=>{

    const transports = await dbApi.db.messages.transport.search() ;
    const lastMessages = await dbApi.db.messages.message.search({}, {first: 10, orderBy: ['CREATE_TIME_DESC']})
    const templates = await dbApi.db.messages.template.search() ;

    return {
        transports,
        lastMessages,
        templates,
    }
}

view.displayed = async ()=>{

    const scrollSpy = new bootstrap.bootstrap.ScrollSpy(document.body, {
        target: '#navbar'
    }) ;

    const links = Array.from(view.getElementById("navbar").querySelectorAll("a"));
    for(let link of links){
        link.addEventListener("click", ev=>{
            ev.preventDefault();
            ev.stopPropagation() ;
            view.getElementById(link.getAttribute("href").replace("#", "")).scrollIntoView() ;
        }) ;
    }

    doHighlight();

}

view.addServer = async ()=>{
    await dialogs.routeModal({ route: "/popup-smtp/" }) ;
    await view.refresh() ;
}

view.editServer = async (transport)=>{
    await dialogs.routeModal({ route: "/popup-smtp/"+transport.code }) ;
    await view.refresh() ;
}
view.deleteServer = async (server)=>{
    if(await dialogs.confirm("Are you sure to delete this server ?")){
        await dbApi.db.messages.transport.deleteByCode(server.code);
        await view.refresh() ;
    }
}

view.addTemplate = async ()=>{
    await dialogs.routeModal({ route: "/popup-template/" }) ;
    await view.refresh() ;
}

view.editTemplate = async (template)=>{
    await dialogs.routeModal({ route: "/popup-template/"+template.code }) ;
    await view.refresh() ;
}
view.deleteTemplate = async (template)=>{
    if(await dialogs.confirm("Are you sure to delete this template ?")){
        await dbApi.db.messages.template.deleteByCode(template.code);
        await view.refresh() ;
    }
}

view.sendMessageTemplate = async (template)=>{
    await dialogs.routeModal({ route: "/popup-template-send-mail/"+template.code }) ;
    await view.refresh() ;
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


view.viewMessage = async (message)=>{
    dialogs.routeModal({ route: "/popup-message-detail/"+message._id, size: "lg" }) ;
}