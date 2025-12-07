/* Javascript */

view.loader = async ()=>{

    const templates = await dbApi.db.messages.template.search() ;

    return {
        templates,
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

view.sendMessage = async (template)=>{
    await dialogs.routeModal({ route: "/popup-template-send-mail/"+template.code }) ;
    await view.refresh() ;
}