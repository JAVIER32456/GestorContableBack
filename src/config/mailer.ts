import nodemailer from 'nodemailer';

const port = Number(process.env.EMAIL_PORT || 587);

export const mailer = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port,
  secure: port === 465,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

mailer.verify()
  .then(() => console.info('[SMTP] Conexión y autenticación correctas'))
  .catch((error: unknown) => console.error('[SMTP] No se pudo conectar o autenticar:', error));