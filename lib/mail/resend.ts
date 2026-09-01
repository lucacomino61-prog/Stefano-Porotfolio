import { Resend } from 'resend'

type Notification = { name: string; email: string; message: string; locale: string }

/**
 * Returns false rather than throwing. A submission that is safely in the
 * database but failed to email is not an error the visitor should see: the
 * message is not lost, and /admin still shows it.
 */
export async function sendContactNotification(input: Notification): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const to = process.env.CONTACT_TO_EMAIL
  const from = process.env.CONTACT_FROM_EMAIL
  if (!apiKey || !to || !from) return false

  try {
    const { error } = await new Resend(apiKey).emails.send({
      from,
      to,
      replyTo: input.email,
      subject: `Portfolio enquiry from ${input.name}`,
      text: [
        `Name:    ${input.name}`,
        `Email:   ${input.email}`,
        `Locale:  ${input.locale}`,
        '',
        input.message,
      ].join('\n'),
    })
    return !error
  } catch {
    return false
  }
}
