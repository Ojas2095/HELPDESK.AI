"""
Swagger UI Custom Styling for AI Helpdesk Backend

This module provides custom CSS and JavaScript for Swagger UI to match
the AI Helpdesk brand identity and improve developer experience.

Features:
- Corporate dark theme with high contrast
- Responsive design for mobile/desktop
- Environment switcher (local/staging/production)
- Auto-collapse models section
- Custom version badge
"""

SWAGGER_UI_CUSTOM_CSS = """
/* AI Helpdesk Swagger UI — Corporate Dark Theme */

/* ── Global Overrides ─────────────────────────────────────────── */
.swagger-ui {
    --bg-primary: #0f172a;
    --bg-secondary: #1e293b;
    --bg-tertiary: #334155;
    --text-primary: #f1f5f9;
    --text-secondary: #94a3b8;
    --accent: #6366f1;
    --accent-hover: #818cf8;
    --success: #22c55e;
    --warning: #f59e0b;
    --danger: #ef4444;
    --info: #3b82f6;
    --border: #334155;
    --radius: 8px;
}

.swagger-ui .wrapper {
    background: var(--bg-primary);
    color: var(--text-primary);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* ── Topbar ───────────────────────────────────────────────────── */
.swagger-ui .topbar {
    background: var(--bg-secondary);
    border-bottom: 3px solid var(--accent);
    padding: 8px 16px;
}

.swagger-ui .topbar .download-url-wrapper .download-url-input {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 2px solid var(--accent);
    border-radius: var(--radius);
    padding: 8px 12px;
}

.swagger-ui .topbar .download-url-wrapper .download-url-input::placeholder {
    color: var(--text-secondary);
}

.swagger-ui .topbar .download-url-wrapper .download-url-btn {
    background: var(--accent);
    color: white;
    border: none;
    border-radius: var(--radius);
    padding: 8px 16px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
}

.swagger-ui .topbar .download-url-wrapper .download-url-btn:hover {
    background: var(--accent-hover);
}

/* ── Info Section ──────────────────────────────────────────────── */
.swagger-ui .info {
    margin: 24px 0;
}

.swagger-ui .info .title {
    color: var(--text-primary);
    font-size: 2em;
    font-weight: 700;
    letter-spacing: -0.02em;
}

.swagger-ui .info .description p,
.swagger-ui .info .description {
    color: var(--text-secondary);
    font-size: 14px;
    line-height: 1.7;
}

.swagger-ui .info .link {
    color: var(--accent);
}

.swagger-ui .info .link:hover {
    color: var(--accent-hover);
}

/* ── Section Headers ───────────────────────────────────────────── */
.swagger-ui .opblock-tag {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    border-bottom: 2px solid var(--border);
    padding-bottom: 8px;
    margin-top: 24px;
}

.swagger-ui .opblock-tag:hover {
    color: var(--accent);
    border-bottom-color: var(--accent);
}

.swagger-ui .opblock-tag-section {
    background: var(--bg-secondary);
}

/* ── Operation Blocks ──────────────────────────────────────────── */
.swagger-ui .opblock {
    border-radius: var(--radius);
    border: 1px solid var(--border);
    margin-bottom: 12px;
    background: var(--bg-secondary);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    transition: box-shadow 0.2s, border-color 0.2s;
}

.swagger-ui .opblock:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    border-color: var(--accent);
}

.swagger-ui .opblock .opblock-summary {
    color: var(--text-primary);
}

.swagger-ui .opblock .opblock-summary-description {
    color: var(--text-secondary);
}

/* GET */
.swagger-ui .opblock.opblock-get {
    background: rgba(34, 197, 94, 0.08);
    border-color: rgba(34, 197, 94, 0.3);
}

.swagger-ui .opblock.opblock-get .opblock-summary-method {
    background: var(--success);
    color: white;
}

/* POST */
.swagger-ui .opblock.opblock-post {
    background: rgba(99, 102, 241, 0.08);
    border-color: rgba(99, 102, 241, 0.3);
}

.swagger-ui .opblock.opblock-post .opblock-summary-method {
    background: var(--accent);
    color: white;
}

/* PUT */
.swagger-ui .opblock.opblock-put {
    background: rgba(245, 158, 11, 0.08);
    border-color: rgba(245, 158, 11, 0.3);
}

.swagger-ui .opblock.opblock-put .opblock-summary-method {
    background: var(--warning);
    color: white;
}

/* DELETE */
.swagger-ui .opblock.opblock-delete {
    background: rgba(239, 68, 68, 0.08);
    border-color: rgba(239, 68, 68, 0.3);
}

.swagger-ui .opblock.opblock-delete .opblock-summary-method {
    background: var(--danger);
    color: white;
}

/* PATCH */
.swagger-ui .opblock.opblock-patch {
    background: rgba(59, 130, 246, 0.08);
    border-color: rgba(59, 130, 246, 0.3);
}

.swagger-ui .opblock.opblock-patch .opblock-summary-method {
    background: var(--info);
    color: white;
}

/* ── Method Badges ─────────────────────────────────────────────── */
.swagger-ui .opblock .opblock-summary-method {
    border-radius: 6px;
    font-weight: 700;
    font-size: 12px;
    padding: 6px 14px;
    min-width: 70px;
    text-align: center;
    letter-spacing: 0.05em;
    text-transform: uppercase;
}

/* ── Parameters ────────────────────────────────────────────────── */
.swagger-ui .parameter__name {
    font-weight: 600;
    color: var(--text-primary);
}

.swagger-ui .parameter__name.required::after {
    color: var(--danger);
    font-size: 12px;
}

.swagger-ui .parameter__name.required {
    color: var(--text-primary);
}

.swagger-ui .parameter__type {
    color: var(--accent);
    font-size: 12px;
}

.swagger-ui tr.parameters td {
    border-bottom: 1px solid var(--border);
}

/* ── Input Fields ──────────────────────────────────────────────── */
.swagger-ui input[type=text],
.swagger-ui textarea,
.swagger-ui select {
    background: var(--bg-tertiary) !important;
    color: var(--text-primary) !important;
    border: 1px solid var(--border) !important;
    border-radius: var(--radius) !important;
    padding: 8px 12px !important;
}

.swagger-ui input[type=text]:focus,
.swagger-ui textarea:focus,
.swagger-ui select:focus {
    border-color: var(--accent) !important;
    outline: none;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}

/* ── Models Section ────────────────────────────────────────────── */
.swagger-ui section.models {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px;
    background: var(--bg-secondary);
}

.swagger-ui section.models h4 {
    color: var(--text-primary);
}

.swagger-ui section.models .model-container {
    background: var(--bg-tertiary);
    border-radius: 6px;
    padding: 12px;
    margin-bottom: 8px;
    border: 1px solid var(--border);
}

.swagger-ui section.models .model-title {
    color: var(--text-primary);
}

.swagger-ui .model {
    color: var(--text-secondary);
}

.swagger-ui .model-title {
    color: var(--accent);
}

/* ── Buttons ───────────────────────────────────────────────────── */
.swagger-ui .btn {
    border-radius: 6px;
    font-weight: 600;
    transition: all 0.2s;
}

.swagger-ui .try-out__btn {
    border: 2px solid var(--accent);
    color: var(--accent);
    background: transparent;
}

.swagger-ui .try-out__btn:hover {
    background: var(--accent);
    color: white;
}

.swagger-ui .btn.execute {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
}

.swagger-ui .btn.execute:hover {
    background: var(--accent-hover);
}

.swagger-ui .btn.authorize {
    color: var(--accent);
    border-color: var(--accent);
    background: transparent;
}

.swagger-ui .btn.authorize:hover {
    background: var(--accent);
    color: white;
}

.swagger-ui .btn.cancel {
    color: var(--danger);
    border-color: var(--danger);
}

.swagger-ui .btn.cancel:hover {
    background: var(--danger);
    color: white;
}

/* ── Response Section ──────────────────────────────────────────── */
.swagger-ui .responses-inner {
    padding: 12px;
}

.swagger-ui .responses-table {
    border-radius: 6px;
    overflow: hidden;
    background: var(--bg-secondary);
}

.swagger-ui .response-col_status {
    color: var(--text-primary);
    font-weight: 600;
}

.swagger-ui .response-col_description {
    color: var(--text-secondary);
}

.swagger-ui .response-col_links {
    color: var(--accent);
}

/* ── Code Blocks ───────────────────────────────────────────────── */
.swagger-ui .highlight-code {
    border-radius: 6px;
    overflow: hidden;
    background: var(--bg-tertiary);
}

.swagger-ui .highlight-code pre {
    background: var(--bg-tertiary) !important;
    color: var(--text-primary);
}

.swagger-ui .microlight {
    background: var(--bg-tertiary) !important;
    color: var(--text-primary) !important;
}

/* ── Authorize Dialog ──────────────────────────────────────────── */
.swagger-ui .dialog-ux .modal-ux {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius);
}

.swagger-ui .dialog-ux .modal-ux-header h3 {
    color: var(--text-primary);
}

.swagger-ui .dialog-ux .modal-ux-content p {
    color: var(--text-secondary);
}

/* ── Scheme Selector ───────────────────────────────────────────── */
.swagger-ui .scheme-container {
    background: var(--bg-secondary);
    border-radius: var(--radius);
    padding: 16px;
    border: 1px solid var(--border);
}

.swagger-ui .scheme-container .schemes > label {
    color: var(--text-primary);
}

/* ── Scrollbar ─────────────────────────────────────────────────── */
::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}

::-webkit-scrollbar-track {
    background: var(--bg-primary);
    border-radius: 4px;
}

::-webkit-scrollbar-thumb {
    background: var(--bg-tertiary);
    border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
    background: var(--text-secondary);
}

/* ── Tables ────────────────────────────────────────────────────── */
.swagger-ui table thead tr th {
    color: var(--text-primary);
    border-bottom: 2px solid var(--border);
}

.swagger-ui table tbody tr td {
    color: var(--text-secondary);
    border-bottom: 1px solid var(--border);
}

/* ── Misc ──────────────────────────────────────────────────────── */
.swagger-ui .opblock-body pre.microlight {
    background: var(--bg-tertiary) !important;
    border: 1px solid var(--border);
    border-radius: var(--radius);
}

.swagger-ui .arrow {
    filter: invert(1);
}

.swagger-ui svg.arrow {
    fill: var(--text-secondary);
}

.swagger-ui .expand-operation svg {
    fill: var(--text-secondary);
}

.swagger-ui .opblock-description-wrapper p,
.swagger-ui .opblock-external-docs-wrapper p {
    color: var(--text-secondary);
}

.swagger-ui .operation-tag-content {
    color: var(--text-secondary);
}

/* ── Mobile Responsive ─────────────────────────────────────────── */
@media (max-width: 768px) {
    .swagger-ui .opblock .opblock-summary {
        flex-direction: column;
        align-items: flex-start;
    }

    .swagger-ui .opblock .opblock-summary-method {
        margin-bottom: 8px;
    }

    .swagger-ui .info .title {
        font-size: 1.5em;
    }
}
"""

SWAGGER_UI_CUSTOM_JS = """
// AI Helpdesk Swagger UI — Corporate Dark Theme Enhancements

document.addEventListener('DOMContentLoaded', function() {
    // Add version badge
    const info = document.querySelector('.swagger-ui .info');
    if (info) {
        const versionBadge = document.createElement('span');
        versionBadge.style.cssText = `
            background: #6366f1;
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            margin-left: 12px;
            vertical-align: middle;
            letter-spacing: 0.05em;
        `;
        versionBadge.textContent = 'v1.0.0';
        const title = info.querySelector('.title');
        if (title) {
            title.appendChild(versionBadge);
        }
    }

    // Add environment selector
    const topbar = document.querySelector('.swagger-ui .topbar');
    if (topbar) {
        const envSelector = document.createElement('div');
        envSelector.style.cssText = `
            position: absolute;
            right: 20px;
            top: 50%;
            transform: translateY(-50%);
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        envSelector.innerHTML = `
            <select id="env-selector" style="
                padding: 6px 12px;
                border: 1px solid #6366f1;
                border-radius: 6px;
                background: #1e293b;
                color: #f1f5f9;
                font-size: 13px;
                cursor: pointer;
            ">
                <option value="local">Local Development</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
            </select>
        `;
        topbar.appendChild(envSelector);

        // Add change handler to switch API server
        const selector = envSelector.querySelector('#env-selector');
        const envUrls = {
            local: window.location.origin,
            staging: 'https://staging-api.helpdesk.ai',
            production: 'https://api.helpdesk.ai'
        };
        selector.addEventListener('change', function() {
            const env = this.value;
            const baseUrl = envUrls[env] || envUrls.local;
            if (window._swaggerUi) {
                window._swaggerUi.specActions.updateUrl(baseUrl + '/openapi.json');
                window._swaggerUi.specActions.download();
            }
        });
    }

    // Add dark mode toggle indicator
    const body = document.querySelector('body');
    if (body) {
        body.style.background = '#0f172a';
    }

    // Auto-collapse models section after load
    setTimeout(function() {
        const models = document.querySelector('.swagger-ui section.models');
        if (models) {
            const toggle = models.querySelector('h4');
            if (toggle) {
                toggle.click();
            }
        }
    }, 500);

    // Add keyboard shortcut hint
    const footer = document.querySelector('.swagger-ui .info .link');
    if (footer) {
        const hint = document.createElement('div');
        hint.style.cssText = `
            margin-top: 16px;
            padding: 12px;
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 8px;
            font-size: 12px;
            color: #94a3b8;
        `;
        hint.innerHTML = `
            <strong style="color: #f1f5f9;">Keyboard Shortcuts:</strong><br>
            <code style="background: #334155; padding: 2px 6px; border-radius: 4px;">Esc</code> — Close expanded operation<br>
            <code style="background: #334155; padding: 2px 6px; border-radius: 4px;">Ctrl+↑/↓</code> — Navigate operations
        `;
        footer.parentNode.insertBefore(hint, footer.nextSibling);
    }
});
"""
