import { Data } from 'ejs';
declare const mailer: (config: IConfigure) => IMailer;
declare global {
    interface IMailer {
        sendEmail(templateName: string, email: string, locals: Data): void;
    }
}
export default mailer;
