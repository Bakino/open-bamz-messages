/* Javascript */

view.loader = async ()=>{

    const transports = await dbApi.db.messages.transport.search() ;

    return {
        transports,
    }
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
