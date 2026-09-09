// src/services/emailService.ts
import nodemailer from 'nodemailer';

// Crear el "transporter" (la máquina de enviar emails)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,      // tu email @gmail.com
    pass: process.env.EMAIL_PASSWORD   // contraseña de app (NO la real)
  }
});

// Función para enviar emails
export const sendContactEmails = async (
    email: string,
    subject: string,
    message: string,
    phone?: string,
    name?: string,
) => {
  try {
    // 📧 Email 1: Confirmación al usuario
    // ${name}
    //<p><strong>Tu mensaje:</strong></p>
    //   <p>${message}</p>
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,  // Al que contacta
      subject: `Hemos recibido tu mensaje: ${subject}`,
      html: `
        <h2>Hola,</h2>
        <p>Gracias por contactarnos. Hemos recibido tu mensaje y te responderemos pronto.</p>
        <hr>
      `
    });

    // 📧 Email 2: Al administrador (tu email)
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.ADMIN_EMAIL,  // Tu email
      subject: `[CONTACTO] ${subject} - De: ${name}`,
      html: `
        <h2>Nuevo mensaje de contacto</h2>
        <p><strong>De:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Teléfono:</strong> ${phone || 'No proporcionado'}</p>
        <p><strong>Asunto:</strong> ${subject}</p>
        <hr>
        <p><strong>Mensaje:</strong></p>
        <p>${message}</p>
      `
    });

    console.log('✅ Emails enviados exitosamente');
  } catch (error) {
    console.error('❌ Error al enviar emails:', error);
    throw error;
  }
};