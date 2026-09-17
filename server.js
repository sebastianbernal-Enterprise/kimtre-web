require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const xss = require('xss');

const app = express();
const PORT = process.env.PORT || 3000;
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'sebastian@kimtre.cl';
const NODE_ENV = process.env.NODE_ENV || 'production';

// Turnstile / reCAPTCHA Secret Keys (Optional)
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || '';
const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY || '';

// Parse allowed origins
const defaultOrigins = [
    'https://kimtre.cl',
    'https://www.kimtre.cl',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
];
const envOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
    : [];
const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

// Trust reverse proxy (Cloudflare, Nginx, Docker) for accurate client IP in rate limiting
app.set('trust proxy', 1);

// Security Headers (Helmet)
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    "'unsafe-eval'",
                    "https://cdn.tailwindcss.com",
                    "https://challenges.cloudflare.com",
                    "https://www.google.com",
                    "https://www.gstatic.com"
                ],
                styleSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    "https://fonts.googleapis.com",
                    "https://cdn.tailwindcss.com"
                ],
                fontSrc: [
                    "'self'",
                    "https://fonts.gstatic.com",
                    "data:"
                ],
                imgSrc: [
                    "'self'",
                    "data:",
                    "https:",
                    "http:"
                ],
                connectSrc: [
                    "'self'",
                    "https://formsubmit.co",
                    "https://challenges.cloudflare.com",
                    "https://www.google.com"
                ],
                frameSrc: [
                    "'self'",
                    "https://challenges.cloudflare.com",
                    "https://www.google.com"
                ],
                objectSrc: ["'none'"],
                upgradeInsecureRequests: []
            }
        },
        crossOriginEmbedderPolicy: false
    })
);

// CORS configuration for public endpoints
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like same-origin navigation or GET static files)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            return callback(null, true);
        }
        return callback(null, false);
    },
    methods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
    credentials: true
}));

// Request body parser with payload size limits to prevent DoS attacks
app.use(express.urlencoded({ extended: true, limit: '15kb' }));
app.use(express.json({ limit: '15kb' }));

// Rate limiter for contact endpoint (Max 5 submissions per IP every 15 minutes)
const contactRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).send('Has alcanzado el límite de intentos de contacto. Por favor espera unos minutos antes de volver a intentar.');
    }
});

// Middleware to verify Origin and Referer on sensitive endpoints
function verifyTrustedOrigin(req, res, next) {
    const origin = req.headers.origin;
    const referer = req.headers.referer;
    
    let requestSource = origin;
    if (!requestSource && referer) {
        try {
            requestSource = new URL(referer).origin;
        } catch {
            requestSource = null;
        }
    }

    if (!requestSource) {
        return res.status(403).send('Solicitud no autorizada: Origen no especificado.');
    }

    const isAllowed = allowedOrigins.some(allowed => {
        try {
            const allowedUrl = new URL(allowed).origin;
            return allowedUrl === requestSource;
        } catch {
            return false;
        }
    });

    if (!isAllowed) {
        return res.status(403).send('Solicitud no autorizada: Origen no permitido.');
    }

    next();
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Static files routing
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

app.get('/favicon.svg', (req, res) => {
    res.sendFile(path.join(__dirname, 'favicon.svg'));
});

app.use('/assets', express.static(path.join(__dirname, 'assets'), {
    maxAge: '1d',
    etag: true
}));

// API endpoint to handle contact form with multi-layer security
app.post('/api/contacto', contactRateLimiter, verifyTrustedOrigin, async (req, res) => {
    try {
        const {
            name,
            phone,
            email,
            company,
            _subject,
            _next,
            _website_check,
            _form_ts,
            'cf-turnstile-response': turnstileToken,
            'g-recaptcha-response': recaptchaToken
        } = req.body;

        // 1. Anti-Bot Honeypot check
        // Real users never fill this field. If filled, silently drop to fool the bot
        if (_website_check && _website_check.trim() !== '') {
            console.warn(`[Anti-Spam] Bot detectado por Honeypot desde IP: ${req.ip}`);
            return res.redirect(_next || '/?status=success');
        }

        // 2. Fast-submission bot detection (Time check)
        if (_form_ts) {
            const formOpenedTime = parseInt(_form_ts, 10);
            const now = Date.now();
            if (!isNaN(formOpenedTime)) {
                const elapsedMs = now - formOpenedTime;
                // If submitted in less than 1.5 seconds, it's an automated script
                if (elapsedMs < 1500) {
                    console.warn(`[Anti-Spam] Bot detectado por velocidad de envío (${elapsedMs}ms) desde IP: ${req.ip}`);
                    return res.redirect(_next || '/?status=success');
                }
            }
        }

        // 3. Optional Cloudflare Turnstile verification
        if (TURNSTILE_SECRET_KEY && turnstileToken) {
            const turnstileVerify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    secret: TURNSTILE_SECRET_KEY,
                    response: turnstileToken,
                    remoteip: req.ip
                })
            });
            const turnstileResult = await turnstileVerify.json();
            if (!turnstileResult.success) {
                return res.status(400).send('Verificación de seguridad fallida. Por favor recarga e intenta nuevamente.');
            }
        }

        // 4. Optional Google reCAPTCHA verification
        if (RECAPTCHA_SECRET_KEY && recaptchaToken) {
            const recaptchaVerify = await fetch('https://www.google.com/recaptcha/api/siteverify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    secret: RECAPTCHA_SECRET_KEY,
                    response: recaptchaToken,
                    remoteip: req.ip
                })
            });
            const recaptchaResult = await recaptchaVerify.json();
            if (!recaptchaResult.success) {
                return res.status(400).send('Verificación de seguridad fallida. Por favor recarga e intenta nuevamente.');
            }
        }

        // 5. Strict Input Validation
        const rawName = (name || '').trim();
        const rawPhone = (phone || '').trim();
        const rawEmail = (email || '').trim();
        const rawCompany = (company || '').trim();

        if (!rawName || rawName.length < 2 || rawName.length > 100) {
            return res.status(400).send('Nombre inválido.');
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
        if (!rawEmail || !emailRegex.test(rawEmail) || rawEmail.length > 120) {
            return res.status(400).send('Correo electrónico inválido.');
        }

        const phoneClean = rawPhone.replace(/[\s\-]/g, '');
        if (!phoneClean || phoneClean.length < 6 || phoneClean.length > 25) {
            return res.status(400).send('Número de WhatsApp inválido.');
        }

        if (!rawCompany || rawCompany.length > 120) {
            return res.status(400).send('Nombre de empresa inválido.');
        }

        // 6. XSS Sanitization
        const sanitizedName = xss(rawName);
        const sanitizedPhone = xss(rawPhone);
        const sanitizedEmail = xss(rawEmail);
        const sanitizedCompany = xss(rawCompany);
        const sanitizedSubject = xss(_subject || 'Nuevo Lead - Web Kimtre');
        const sanitizedNext = xss(_next || '');

        // 7. Prepare payload for FormSubmit (without _captcha: false)
        const formData = new URLSearchParams();
        formData.append('name', sanitizedName);
        formData.append('phone', sanitizedPhone);
        formData.append('email', sanitizedEmail);
        formData.append('company', sanitizedCompany);
        formData.append('_subject', sanitizedSubject);
        formData.append('_next', sanitizedNext);

        // 8. Forward to FormSubmit via server-side fetch
        const targetUrl = `https://formsubmit.co/${CONTACT_EMAIL}`;
        const response = await fetch(targetUrl, {
            method: 'POST',
            body: formData,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        // 9. Redirect to success state
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

// Global error handler to prevent stack trace leaks
app.use((err, req, res, next) => {
    console.error('Error no controlado:', err.message);
    res.status(err.status || 500).send('Error al procesar la solicitud.');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT} [${NODE_ENV}]`);
});
