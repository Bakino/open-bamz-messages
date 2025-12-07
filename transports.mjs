let contextOfApp = null;

export function init({appContext}) {
    contextOfApp = appContext ;
}

export async function runTransport({appName, transport, messageParams}) {
    let appContext = await contextOfApp(appName) ;
    let allTransporters = appContext.pluginsData["messages"]?.pluginSlots?.transporters??[] ;
    
    let transporter = allTransporters.find(t => t.type === transport.type) ;
    if(!transporter){
        throw new Error(`Transporter ${transport.type} not found`) ;
    }
    return await transporter.sendMessage({transportParams: transport.settings, messageParams}) ;
}
