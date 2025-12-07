
import nodemailer from "nodemailer";

export default async function sendMessage({transportParams, messageParams}) {
    
    // Create the SMTP transporter
    const transporter = nodemailer.createTransport(transportParams);

    if(messageParams.attachments){
        for(let attachment of messageParams.attachments){
            if(attachment.path && !attachment.path.startsWith("https://") && !attachment.path.startsWith("http://") && !attachment.path.startsWith("data:")){
                throw new Error("Attachment path must be a URL or data URI. Local paths are not supported.");
            }
        }
    }

    // Send the email
    const info = await transporter.sendMail(messageParams);

    return info
}