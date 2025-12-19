import sendMessage from "./smtp/smtp.mjs";
import { init } from "./transports.mjs";


/**
 * Called on each application startup (or when the plugin is enabled)
 * 
 * Use it to prepare the database and files needed by the plugin
 */
export const prepareDatabase = async ({ client, grantSchemaAccess }) => {
    //console.log(`CREATE SCHEMA IF NOT EXISTS users`);
    await client.query(`CREATE SCHEMA IF NOT EXISTS messages`);
    
    // Settings
    await client.query(`CREATE TABLE IF NOT EXISTS messages.transport(
        code text PRIMARY KEY,          -- code of the transport
        name text,                      -- name of the transport
        type text,                      -- type of the transport (smtp, sms, ...)
        settings jsonb,                 -- settings of the transport
        active boolean DEFAULT true    -- is the transport active
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS messages.message(
        _id uuid primary key DEFAULT gen_random_uuid(),
        create_time timestamp without time zone DEFAULT now(),
        transport text REFERENCES messages.transport(code),
        parameters jsonb,                           -- parameters of the message
        status text DEFAULT 'to_send',              -- status of the message (pending, sent, failed)
        error text,                                 -- error message if the message failed
        sent_time timestamp without time zone       -- time when the message was sent
    )`);
    
    await client.query(`CREATE TABLE IF NOT EXISTS messages.message_log(
        _id uuid primary key DEFAULT gen_random_uuid(),
        create_time timestamp without time zone DEFAULT now(),
        message_id uuid REFERENCES messages.message(_id),
        type text,                              -- type of the log (info, error, ...)
        message text,                           -- message of the log
        data jsonb                              -- data of the log
    )`);

    await client.query(`CREATE OR REPLACE FUNCTION messages.trigger_send_message()
        RETURNS TRIGGER AS $$
            plv8.execute("INSERT INTO messages.message_log(message_id, type, message) VALUES ($1, $2, $3)", 
                    [NEW._id, "created", "Message created"]);
            plv8.execute("SELECT graphile_worker.add_job('runPluginTask', $1)", 
                [{plugin: 'open-bamz-messages', task : 'tasks/sendMessage.mjs', params: {messageId: NEW._id}}]);
        $$ LANGUAGE "plv8" SECURITY DEFINER`)

    await client.query(`CREATE OR REPLACE TRIGGER trigger_send_message
    AFTER INSERT
    ON messages.message FOR EACH ROW
    EXECUTE PROCEDURE messages.trigger_send_message()`)


    await client.query(`CREATE TABLE IF NOT EXISTS messages.template(
        code text primary key,                      -- code of the template
        create_time timestamp without time zone DEFAULT now(),
        transport text REFERENCES messages.transport(code),
        parameters jsonb,                           -- parameters of the message
        variables_structure jsonb,                  -- extracted variables used in the template
        name text                                   -- name of the template
    )`);

    // trigger to extract the variables from the template
    await client.query(`CREATE OR REPLACE FUNCTION messages.trigger_extract_variables()
        RETURNS TRIGGER AS $$
            if(!OLD || JSON.stringify(OLD.parameters) != JSON.stringify(NEW.parameters)){
                // for each variable of parameters, extract the variables from the template
                let strVariables = "" ;

                function extractAllStrings(obj) {
                   for(let key of Object.keys(obj)){
                        let value = obj[key];
                        if(typeof(value) == "string" && value.includes("\${")){
                            strVariables += value + "\\n";
                        }else if(typeof(value) == "object"){
                            if(Array.isArray(value)){
                                for(let v of value){
                                    if(typeof(v) == "string" && v.includes("\${")){
                                        strVariables += v + "\\n";
                                    }else if(typeof(v) == "object"){
                                        extractAllStrings(v);
                                    }
                                }
                            }else{
                                extractAllStrings(value);
                            }
                        }
                    }
                }
                extractAllStrings(NEW.parameters) ; 

                if(!strVariables){
                    return NEW;
                }

                function extractTemplateVariables(templateString) {
                    // Regular expression to capture \${...} expressions
                    const regex = /\\\${([^}]+)}/g;
                    const matches = templateString.matchAll(regex);
                
                    // Map to store variables and their sub-properties
                    const variablesMap = new Map();
                    
                    // Iterate through all found expressions
                    for (const match of matches) {
                        const expression = match[1].trim();
                        const parts = expression.split('.');
                        
                        // First element is the root variable
                        const rootVariable = parts[0];
                        
                        // Create or retrieve the structure for this root variable
                        if (!variablesMap.has(rootVariable)) {
                            variablesMap.set(rootVariable, { variable: rootVariable });
                        }
                        
                        let currentObj = variablesMap.get(rootVariable);
                        
                        // If there are sub-properties, add them recursively
                        if (parts.length > 1) {
                            for (let i = 1; i < parts.length; i++) {
                                if (!currentObj.sub) {
                                    currentObj.sub = [];
                                }
                                
                                // Check if the sub-property already exists
                                let subObj = currentObj.sub.find(item => item.variable === parts[i]);
                                
                                if (!subObj) {
                                    subObj = { variable: parts[i] };
                                    currentObj.sub.push(subObj);
                                }
                                
                                // Move to the next property for the next iteration
                                currentObj = subObj;
                            }
                        }
                    }
                    
                    // Convert the Map to an array of results
                    return Array.from(variablesMap.values());
                }
                
                // Extract variables from the template string
                const extractedVariables = extractTemplateVariables(strVariables);

                NEW.variables_structure = extractedVariables;
            }
            return NEW;
        $$ LANGUAGE "plv8" SECURITY DEFINER`)

    await client.query(`CREATE OR REPLACE TRIGGER trigger_extract_variables
    BEFORE INSERT OR UPDATE
    ON messages.template FOR EACH ROW
    EXECUTE PROCEDURE messages.trigger_extract_variables()`)


    await client.query(`ALTER TABLE messages.message ADD COLUMN IF NOT EXISTS template_code text REFERENCES messages.template(code)`);

    await client.query(`CREATE OR REPLACE FUNCTION messages.create_from_template(template_code text, data jsonb) RETURNS uuid AS $$
        let template = plv8.execute("SELECT * FROM messages.template WHERE code = $1", [template_code])[0];
        if(!template){
            throw new Error("Template "+template_code+" not found");
        }

        const mergeData = data ;

        function prepareMergeData(d, structure){
            for(let v of structure){
                if(v.sub && v.sub.length > 0){
                    if(!d[v.variable]){
                        d[v.variable] = {};
                    }
                    prepareMergeData(d[v.variable], v.sub);
                }else{
                    if(!d[v.variable]){
                        d[v.variable] = "";
                    }
                }
            }
        }
        prepareMergeData(mergeData, template.variables_structure??[]);

        function mergeParams(params){
            for(let key in params){
                let value = params[key];
                if(typeof(value) == "string" && value.includes("\${")){
                    let funcValue = new Function(Object.keys(mergeData), "return \`"+value+"\`")
                    params[key] = funcValue.apply(null, Object.values(mergeData)) ;
                } else if(typeof(value) == "object"){
                    if(Array.isArray(value)){
                        for(let v of value){
                            if(typeof(v) == "string" && v.includes("\${")){
                                let funcValue = new Function(Object.keys(mergeData), "return \`"+v+"\`")
                                params[key] = funcValue.apply(null, Object.values(mergeData)) ;
                            }else if(typeof(v) == "object"){
                                mergeParams(v);
                            }
                        }
                    }else{
                        mergeParams(value);
                    }
                }
            }
        }

        mergeParams(template.parameters);
        
        let res = plv8.execute("INSERT INTO messages.message(transport, parameters, template_code) VALUES ($1, $2, $3) RETURNING _id", 
            [template.transport, template.parameters, template.template_code]);
        if(res.length == 0){
            throw new Error("Message not created");
        }
        let message_id = res[0]._id;
        
        return message_id;
    $$ LANGUAGE "plv8" SECURITY DEFINER`);


    await grantSchemaAccess("messages", "admin"); ;
}

/**
 * Called when the plugin is disabled
 * 
 * Use it to eventually clean the database and files created by the plugin
 */
export const cleanDatabase = async ({ client }) => { 
    await client.query(`DROP SCHEMA IF EXISTS messages CASCADE`);
}


/**
 * Init plugin when Open BamZ platform start
 */
export const initPlugin = async ({ loadPluginData, graphql, hasCurrentPlugin, contextOfApp, logger }) => {
    
    //give the context to the transporter factory
    init({appContext: contextOfApp}) ;

    loadPluginData(async ({pluginsData})=>{
        // register the SMTP transporter
        if(pluginsData?.["open-bamz-messages"]?.pluginSlots?.transporters){
            pluginsData?.["open-bamz-messages"]?.pluginSlots?.transporters.push( {
                type: "smtp",
                sendMessage: sendMessage
            }) ;
        }
    })

    return {
        // path in which the plugin provide its front end files
        frontEndPath: "front",
        //lib that will be automatically load in frontend
        //frontEndLib: "lib/db-loader.mjs",
        menu: [
            { name: "admin", entries: [
                { name: "Messages", link: "/plugin/open-bamz-messages/messages" }
            ]}
        ],
        pluginSlots: {
            //slot for other plugin to add their own transporters
            transporters: []
        }
    }
}