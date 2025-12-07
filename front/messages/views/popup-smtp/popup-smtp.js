/* Javascript */

view.loader = async ()=>{

    let data = {type: "smtp", settings: {}, active: true} ;

    if(view.route.params.code){
        data = await dbApi.db.messages.transport.getByCode(view.route.params.code) ;
    }
    return data
}

view.validate = async ()=>{
    if(bootstrap.validateForm(/** @type {HTMLFormElement} */ (view.querySelector("form")))){
        if(view.route.params.code){
            let update = { ...view.data } ;
            await dbApi.db.messages.transport.updateByCode(view.route.params.code, update) ;
        }else{
            await dbApi.db.messages.transport.create({...view.data}) ;
        }
        view.closePopup() ;
    }
}