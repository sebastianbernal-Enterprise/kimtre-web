// cookies-control.js - Control de cookies y privacidad para Kimtre
(function() {
    // Configuración por defecto
    const DEFAULT_PREFERENCES = {
        analytics: true,
        metaPixel: true,
        personalizedAds: true
    };

    // Guardar consentimiento en localStorage y como cookie
    function saveConsent(accepted, preferences = null) {
        const decision = {
            accepted: accepted,
            timestamp: new Date().toISOString(),
            preferences: preferences || (accepted ? { ...DEFAULT_PREFERENCES } : { analytics: false, metaPixel: false, personalizedAds: false })
        };
        
        // Guardar en localStorage
        localStorage.setItem('kimtre_cookie_consent', JSON.stringify(decision));
        
        // Guardar como Cookie para persistencia del lado del servidor si es necesario
        // "En caso de que rechaces, necesariamente usaremos la cookie para guardar tu decisión"
        const cookieValue = encodeURIComponent(JSON.stringify(decision));
        const expires = new Date();
        expires.setFullYear(expires.getFullYear() + 1); // 1 año de duración
        document.cookie = `kimtre_cookie_consent=${cookieValue}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
        
        // Aplicar los cambios
        applyPreferences(decision.preferences);
    }

    // Leer consentimiento
    function getConsent() {
        const local = localStorage.getItem('kimtre_cookie_consent');
        if (local) {
            try { return JSON.parse(local); } catch(e) {}
        }
        
        // Intentar leer de la cookie si no está en localStorage
        const match = document.cookie.match(new RegExp('(^| )kimtre_cookie_consent=([^;]+)'));
        if (match) {
            try { return JSON.parse(decodeURIComponent(match[2])); } catch(e) {}
        }
        return null;
    }

    // Aplicar preferencias (por ejemplo, desactivar analytics)
    function applyPreferences(preferences) {
        window.cookiePreferences = preferences;
        
        // Si analytics está desactivado, configurar la exclusión de Google Analytics
        if (!preferences.analytics) {
            window['ga-disable-UA-XXXXXXXX-X'] = true; // Reemplazar con ID real si se usa
            window['ga-disable-G-XXXXXXXXXX'] = true; 
        } else {
            delete window['ga-disable-UA-XXXXXXXX-X'];
            delete window['ga-disable-G-XXXXXXXXXX'];
        }
        
        // Si metaPixel está desactivado, podemos simular la exclusión o limitar el tracking de Meta
        if (!preferences.metaPixel) {
            if (window.fbq) {
                fbq('consent', 'revoke');
            }
        } else {
            if (window.fbq) {
                fbq('consent', 'grant');
            }
        }
    }

    // Inyectar HTML y CSS del Banner de Cookies y el Panel de Control
    function injectElements() {
        // Banner HTML
        const bannerHtml = `
            <div id="cookie-banner" class="fixed bottom-0 left-0 right-0 z-[100] p-4 md:p-6 transition-all duration-500 translate-y-full">
                <div class="max-w-7xl mx-auto glass-banner rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10">
                    <div class="flex-grow text-[#e5e2e1] text-sm md:text-base leading-relaxed md:max-w-4xl text-left">
                        <span class="inline-flex items-center gap-1.5 text-sky-400 font-bold mb-1 uppercase text-xs tracking-wider">
                            <span class="material-symbols-outlined text-[16px]">cookie</span> Uso de Cookies
                        </span>
                        <p class="mt-1 text-[#e5e2e1]/90">
                            Este sitio web almacena cookies en tu dispositivo, las que sirven para mejorar tu experiencia navegando nuestro sitio web y ofrecer servicios más personalizados. Para conocer más acerca de las cookies que utilizamos, revisa nuestra <a href="politica-cookies.html" class="underline text-sky-400 hover:text-sky-300 transition-colors font-medium">Política de Uso de Cookies</a>. En caso de que rechaces, necesariamente usaremos la cookie para guardar tu decisión.
                        </p>
                    </div>
                    <div class="flex items-center gap-4 shrink-0 w-full md:w-auto justify-end">
                        <button id="btn-reject-cookies" class="px-4 py-2.5 text-sm font-semibold text-[#e5e2e1]/80 hover:text-white transition-all rounded hover:bg-white/5">
                            Rechazar
                        </button>
                        <button id="btn-accept-cookies" class="px-6 py-2.5 bg-white text-[#141313] hover:bg-[#F2F1ED] font-bold text-sm rounded shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98]">
                            Aceptar
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Modal HTML (Panel de Control de Cookies)
        const modalHtml = `
            <div id="cookie-modal" class="fixed inset-0 z-[110] hidden items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                <div class="glass-modal w-full max-w-lg rounded-2xl p-6 md:p-8 border border-white/10 shadow-2xl flex flex-col gap-6 text-left max-h-[90vh] overflow-y-auto">
                    <div class="flex justify-between items-center border-b border-white/10 pb-4">
                        <div class="flex items-center gap-2">
                            <span class="material-symbols-outlined text-sky-400 text-2xl">tune</span>
                            <h2 class="text-xl md:text-2xl font-bold text-white font-headline">Panel de Control de Cookies</h2>
                        </div>
                        <button id="close-cookie-modal" class="text-white/60 hover:text-white transition-colors">
                            <span class="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    <div class="space-y-6 py-2">
                        <!-- Google Analytics Toggle -->
                        <div class="flex items-start justify-between gap-4">
                            <div class="flex-grow">
                                <label for="toggle-analytics" class="font-semibold text-white block cursor-pointer">Google Analytics</label>
                                <span class="text-xs text-[#e5e2e1]/60 block mt-0.5">Permite analizar el tráfico y comportamiento de los usuarios para mejorar la experiencia de navegación.</span>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                                <input type="checkbox" id="toggle-analytics" class="sr-only peer" checked>
                                <div class="w-11 h-6 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
                            </label>
                        </div>

                        <!-- Meta Pixel Toggle -->
                        <div class="flex items-start justify-between gap-4">
                            <div class="flex-grow">
                                <label for="toggle-meta" class="font-semibold text-white block cursor-pointer">Meta Pixel (Facebook/Instagram)</label>
                                <span class="text-xs text-[#e5e2e1]/60 block mt-0.5">Permite medir el rendimiento de los anuncios en redes sociales y mostrar publicidad más relevante.</span>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                                <input type="checkbox" id="toggle-meta" class="sr-only peer" checked>
                                <div class="w-11 h-6 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
                            </label>
                        </div>

                        <!-- Personalized Ads Toggle -->
                        <div class="flex items-start justify-between gap-4">
                            <div class="flex-grow">
                                <label for="toggle-ads" class="font-semibold text-white block cursor-pointer">Anuncios Personalizados</label>
                                <span class="text-xs text-[#e5e2e1]/60 block mt-0.5">Optimiza la pauta comercial para recibir ofertas y contenido según tus intereses.</span>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                                <input type="checkbox" id="toggle-ads" class="sr-only peer" checked>
                                <div class="w-11 h-6 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
                            </label>
                        </div>

                        <!-- Data Request Button -->
                        <div class="border-t border-white/10 pt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h3 class="font-semibold text-white">¿Deseas una copia de tus datos?</h3>
                                <p class="text-xs text-[#e5e2e1]/60 mt-0.5">De acuerdo con nuestra política de privacidad, puedes solicitar un archivo descargable con toda tu información registrada.</p>
                            </div>
                            <button id="btn-request-data" class="px-4 py-2 border border-white/20 hover:border-white hover:bg-white/5 text-white font-semibold text-xs rounded transition-all shrink-0">
                                Solicitar Datos
                            </button>
                        </div>
                    </div>

                    <div class="border-t border-white/10 pt-4 flex gap-4 justify-end">
                        <button id="btn-save-cookie-settings" class="w-full py-2.5 bg-white text-[#141313] hover:bg-[#F2F1ED] font-bold text-sm rounded shadow-lg transition-all">
                            Guardar Preferencias
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Agregar estilos CSS necesarios
        const style = document.createElement('style');
        style.textContent = `
            .glass-banner {
                background: rgba(27, 37, 51, 0.85);
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
            }
            .glass-modal {
                background: rgba(27, 37, 51, 0.95);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
            }
        `;
        document.head.appendChild(style);

        // Insertar en el body
        const container = document.createElement('div');
        container.innerHTML = bannerHtml + modalHtml;
        document.body.appendChild(container);
    }

    // Inicialización del script
    function init() {
        injectElements();

        const banner = document.getElementById('cookie-banner');
        const modal = document.getElementById('cookie-modal');
        const btnAccept = document.getElementById('btn-accept-cookies');
        const btnReject = document.getElementById('btn-reject-cookies');
        const btnSave = document.getElementById('btn-save-cookie-settings');
        const btnClose = document.getElementById('close-cookie-modal');
        const btnRequestData = document.getElementById('btn-request-data');

        const toggleAnalytics = document.getElementById('toggle-analytics');
        const toggleMeta = document.getElementById('toggle-meta');
        const toggleAds = document.getElementById('toggle-ads');

        const consent = getConsent();

        if (consent) {
            applyPreferences(consent.preferences);
            // Cargar los valores actuales en los toggles
            toggleAnalytics.checked = consent.preferences.analytics;
            toggleMeta.checked = consent.preferences.metaPixel;
            toggleAds.checked = consent.preferences.personalizedAds;
        } else {
            // Mostrar banner con delay sutil
            setTimeout(() => {
                banner.classList.remove('translate-y-full');
            }, 500);
        }

        // Eventos del banner
        btnAccept.addEventListener('click', () => {
            saveConsent(true);
            banner.classList.add('translate-y-full');
        });

        btnReject.addEventListener('click', () => {
            saveConsent(false);
            banner.classList.add('translate-y-full');
        });

        // Eventos del modal
        const openModal = () => {
            const currentConsent = getConsent();
            if (currentConsent) {
                toggleAnalytics.checked = currentConsent.preferences.analytics;
                toggleMeta.checked = currentConsent.preferences.metaPixel;
                toggleAds.checked = currentConsent.preferences.personalizedAds;
            }
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        };

        const closeModal = () => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        };

        btnClose.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        btnSave.addEventListener('click', () => {
            const preferences = {
                analytics: toggleAnalytics.checked,
                metaPixel: toggleMeta.checked,
                personalizedAds: toggleAds.checked
            };
            saveConsent(true, preferences);
            closeModal();
            banner.classList.add('translate-y-full');
        });

        btnRequestData.addEventListener('click', () => {
            const email = "sebastian@kimtre.cl";
            const subject = encodeURIComponent("Solicitud de copia de datos personales - Kimtre");
            const body = encodeURIComponent("Hola equipo de Kimtre,\n\nSolicito formalmente una copia de mis datos personales de acuerdo con su Política de Privacidad.\n\nSaludos.");
            window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
        });

        // Escuchar evento global para abrir configuración
        window.addEventListener('open-cookie-settings', openModal);
    }

    // Ejecutar al cargar el DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
