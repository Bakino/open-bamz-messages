/* Javascript */

view.loader = async ()=>{
    const template = await dbApi.db.messages.template.getByCode(view.route.params.template) ;

    return {
        template,
        params: ""
    }
}

view.sendMessage = async ()=>{
    let data = null;
    try{
        data = JSON.parse(view.data.params) ;
    }catch(err){
        return dialogs.error("The params should be in JSON format")
    }

    await dbApi.db.messages.mutations.create_from_template({input: {template_code: view.data.template.code, data: data}})
    view.closePopup() ;
}