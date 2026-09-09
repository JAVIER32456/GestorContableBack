import express from 'express';
import type { Router } from 'express';
import prisma from '../prisma.js';
import { sendContactEmails } from '../services/emailService.js';
const router: Router = express.Router();

router.post('/', async (req: any, res: any) => {
    try {
        const { name, email, subject, message, phone } = req.body;

        if (!email || !subject || !message) {
        return res.status(400).json({ error: 'Campos requeridos: email, subject, message' });
        }

        const contactMessage = await prisma.contactMessage.create({
        data: {
            name: name || null,
            email,
            subject,
            message,
            phone: phone || null,
            status: 'pending',
        },
        });

        // 3️⃣ ENVIAR EMAILS (aquí viene Nodemailer)
        await sendContactEmails(email, subject, message, phone, name);

        // 4️⃣ RESPONDER
        res.status(201).json({
        success: true,
        message: 'Mensaje recibido correctamente',
        data: contactMessage
        });

    } catch (error) {
        res.status(500).json({ error: 'Error al crear mensaje de contacto' });
    }
});

// GET - Listar todos los mensajes (opcional, para admin)
router.get('/', async (req: any, res: any) => {
  try {
    const messages = await prisma.contactMessage.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json({ data: messages });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener mensajes' });
  }
});


export default router;