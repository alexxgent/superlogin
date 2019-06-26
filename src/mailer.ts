import d from 'debug'
import ejs, { Data } from 'ejs'
import fs from 'fs'
import nodemailer from 'nodemailer'
import stubTransport from 'nodemailer-stub-transport'
import { promisify } from 'util'

const debug = d('superlogin')

const mailer = (config: IConfigure): IMailer => {
  const configMailer = config.get().mailer
  const configTestMode = config.get().testMode
  const transport =
    !configMailer || (configTestMode && configTestMode.noEmail)
      ? stubTransport()
      : configMailer.transport || configMailer.options

  // Initialize the transport mechanism with nodermailer
  const transporter = nodemailer.createTransport(transport)
  transporter.sendMail = transporter.sendMail.bind(transporter)
  const sendEmail = promisify(transporter.sendMail)

  return {
    sendEmail: async (templateName: string, email: string, locals: Data) => {
      // load the template and parse it
      const template = config.get().emails[templateName]
      if (!template) {
        return Promise.reject(`No template found for "${templateName}".`)
      }
      const { subject, format, template: templatePath } = template
      const templateFile = fs.readFileSync(templatePath, 'utf8')
      if (!templateFile) {
        return Promise.reject(`Failed to locate template file: ${templatePath}`)
      }
      const body = ejs.render(templateFile, locals)
      // form the email
      const mailOptions = {
        from: configMailer ? configMailer.fromEmail : undefined,
        to: email,
        subject,
        html: format === 'html' ? body : undefined,
        text: format !== 'html' ? body : undefined
      }
      if (configTestMode && configTestMode.debugEmail) {
        debug(mailOptions)
      }
      // send the message
      return sendEmail(mailOptions)
    }
  }
}

declare global {
  interface IMailer {
    sendEmail(templateName: string, email: string, locals: Data): void
  }
}

export default mailer
