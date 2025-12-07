import { runTransport } from "../transports.mjs";

export default async function(payload, {query, logger, appName}){
    logger.info(`Start sent message ${payload.messageId}`)
    try{
        let result = await query(`SELECT * FROM messages.message WHERE _id = $1`, [payload.messageId])
        if(result.rows.length === 0){
            logger.error(`Message ${payload.messageId} not found`);
            return;
        }
        let message = result.rows[0];
        if(message.status !== "to_send"){
            logger.error(`Message ${payload.messageId} not to sent`);
            await query(`UPDATE messages.message SET status = 'error', error = 'Message status not to send' WHERE _id = $1`, [payload.messageId]);
            return;
        }
        let transport = null;
        if(message.transport){
            let resultTransport = await query(`SELECT * FROM messages.transport WHERE code = $1`, [message.transport])
            if(resultTransport.rows.length === 0){
                logger.error(`Transport ${message.transport} not found`);
                await query(`UPDATE messages.message SET status = 'failed', error = 'Transport not found' WHERE _id = $1`, [payload.messageId]);
                return;
            }
            transport = resultTransport.rows[0];
            if(!transport.active){
                logger.error(`Transport ${message.transport} not active`);
                await query(`UPDATE messages.message SET status = 'failed', error = 'Transport not active' WHERE _id = $1`, [payload.messageId]);
                return;
            }
        }else{
            // no explicit transport, use the first one
            let resultTransport = await query(`SELECT * FROM messages.transport WHERE active = true LIMIT 1`)
            if(resultTransport.rows.length === 0){
                logger.error(`No transport found`);
                await query(`UPDATE messages.message SET status = 'failed', error = 'No transport found' WHERE _id = $1`, [payload.messageId]);
                return;
            }
            transport = resultTransport.rows[0];
            logger.info("Use transport "+ transport.code);
        }

        let timeoutId = setTimeout(() => {
            logger.error(`Timeout while sending message ${payload.messageId}`);
            query(`UPDATE messages.message SET status = 'failed', error = 'Timeout' WHERE _id = $1`, [payload.messageId]);
        } , 20000);

        //don't use await to handle the timeout
        runTransport({transport, messageParams: message.parameters, appName})
            .then((result) => {
                clearTimeout(timeoutId);
                logger.info(`Message ${payload.messageId} sent %o`, result);
                query(`UPDATE messages.message SET status = 'sent', sent_time = now() WHERE _id = $1`, [payload.messageId]);
                query(`INSERT INTO messages.message_log(message_id, type, message, data) VALUES ($1, $2, $3, $4)`, 
                    [payload.messageId, "sent", "Message sent", result]);
            })
            .catch((err) => {
                clearTimeout(timeoutId);
                logger.error(`Error while sending message ${payload.messageId} : %o`, err);
                query(`UPDATE messages.message SET status = 'failed', error = $1 WHERE _id = $2`, [err.message, payload.messageId]);
                query(`INSERT INTO messages.message_log(message_id, type, message, data) VALUES ($1, $2, $3, $4)`, 
                    [payload.messageId, "error", "Error while sending message", {error: err.message}]);
            }).finally(() => {
                clearTimeout(timeoutId);
                logger.info(`End sent message ${payload.messageId}`)
            });
    }catch(err){
        logger.error(`Error while sending message ${payload.messageId} : %o`, err);
    }
}