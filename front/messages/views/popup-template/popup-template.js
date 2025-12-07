/* Javascript */

view.loader = async ()=>{

    const transports = await dbApi.db.messages.transport.search() ;
    let template = {parameters: {}} ;

    if(view.route.params.code){
        template = await dbApi.db.messages.template.getByCode(view.route.params.code) ;
    }

    return {
        transports,
        template
    }
}

view.validate = async ()=>{
    if(bootstrap.validateForm(/** @type {HTMLFormElement} */ (view.querySelector("form")))){
        if(view.route.params.code){
            let update = { ...view.data.template } ;
            await dbApi.db.messages.template.updateByCode(view.route.params.code, update) ;
        }else{
            await dbApi.db.messages.template.create({...view.data.template}) ;
        }
        view.closePopup() ;
    }
}