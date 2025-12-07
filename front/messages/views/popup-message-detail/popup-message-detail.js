/* Javascript */

view.loader = async ()=>{
    const message = await dbApi.db.messages.message.getBy_id(view.route.params.id) ;

    const logs = await dbApi.db.messages.message_log.search({ message_id: view.route.params.id }, {orderBy: ["CREATE_TIME_ASC"]})

    return {
        message, logs
    }
}