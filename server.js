require('dotenv').config();
const express = require('express');
const path = require('path');
const xss = require('xss');

const app = express();
const PORT = process.env.PORT || 3000;
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'sebastian@kimtre.cl';

// Parse form and JSON bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Secure static file serving (exposes only what is needed, preventing access to server files)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/politica-cookies.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'politica-cookies.html'));
});

app.get('/Poli%CC%81tica_de_Privacidad_Kimtre.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'Política_de_Privacidad_Kimtre.html'));
});

app.get('/cookies-control.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'cookies-control.js'));
});

app.use('/assets', express.static(path.join(__dirname, 'assets')));

// API endpoint to handle contact form with server-side sanitization
app.post('/api/contacto', async (req, res) => {
    try {
        // Extract fields
        const { name, phone, email, company, _subject, _captcha, _next } = req.body;

        // Sanitize strings to prevent XSS (filter tags like <script> or <iframe>)
        const sanitizedName = xss(name || '');
        const sanitizedPhone = xss(phone || '');
        const sanitizedEmail = xss(email || '');
        const sanitizedCompany = xss(company || '');
        const sanitizedSubject = xss(_subject || 'Nuevo Lead - Web Kimtre');
        const sanitizedCaptcha = xss(_captcha || 'false');
        const sanitizedNext = xss(_next || '');

        // Prepare payload for FormSubmit
        const formData = new URLSearchParams();
        formData.append('name', sanitizedName);
        formData.append('phone', sanitizedPhone);
        formData.append('email', sanitizedEmail);
        formData.append('company', sanitizedCompany);
        formData.append('_subject', sanitizedSubject);
        formData.append('_captcha', sanitizedCaptcha);
        formData.append('_next', sanitizedNext);

        // Forward to FormSubmit via server-side fetch
        const targetUrl = `https://formsubmit.co/${CONTACT_EMAIL}`;
        const response = await fetch(targetUrl, {
            method: 'POST',
            body: formData,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        // Redirect to success page or the target specified in _next
        if (sanitizedNext) {
            res.redirect(sanitizedNext);
        } else {
            res.redirect('/?status=success');
        }
    } catch (error) {
        console.error('Error in contact API:', error);
        res.status(500).send('Hubo un error al procesar tu solicitud.');
    }
});

// Fallback: Redirect anything else to root page
app.use((req, res) => {
    res.redirect('/');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
