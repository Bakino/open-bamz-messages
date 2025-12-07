/* Javascript */

view.loader = async ()=>{

    const lastMessages = await dbApi.db.messages.message.search({}, {first: 100, orderBy: ['CREATE_TIME_DESC']})

    return {
        lastMessages
    }
}



view.viewMessage = async (message)=>{
    dialogs.routeModal({ route: "/popup-message-detail/"+message._id, size: "lg" }) ;
}