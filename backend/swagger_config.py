"""
Swagger UI Custom Styling for AI Helpdesk Backend

This module provides custom CSS and JavaScript for Swagger UI to match
the AI Helpdesk brand identity and improve developer experience.
"""

SWAGGER_UI_CUSTOM_CSS = """
/* AI Helpdesk Swagger UI Custom Theme - Light */

/* Header bar */
.swagger-ui .topbar {
    background-color: #1a1a2e;
    border-bottom: 3px solid #4361ee;
}

.swagger-ui .topbar .download-url-wrapper .download-url-input {
    border: 2px solid #4361ee;
    border-radius: 4px;
}

/* Title */
.swagger-ui .info .title {
    color: #1a1a2e;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 2em;
    font-weight: 700;
}

.swagger-ui .info .description p {
    color: #4a5568;
    font-size: 14px;
    line-height: 1.6;
}

/* Section headers */
.swagger-ui .opblock-tag {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 16px;
    font-weight: 600;
    color: #2d3748;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 8px;
}

.swagger-ui .opblock-tag:hover {
    color: #4361ee;
    border-bottom-color: #4361ee;
}

/* Operation blocks */
.swagger-ui .opblock {
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    margin-bottom: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.swagger-ui .opblock:hover {
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

/* GET operations */
.swagger-ui .opblock.opblock-get {
    background: rgba(72, 187, 120, 0.04);
    border-color: #48bb78;
}

.swagger-ui .opblock.opblock-get .opblock-summary-method {
    background: #48bb78;
}

/* POST operations */
.swagger-ui .opblock.opblock-post {
    background: rgba(67, 97, 238, 0.04);
    border-color: #4361ee;
}

.swagger-ui .opblock.opblock-post .opblock-summary-method {
    background: #4361ee;
}

/* PUT operations */
.swagger-ui .opblock.opblock-put {
    background: rgba(237, 137, 54, 0.04);
    border-color: #ed8936;
}

.swagger-ui .opblock.opblock-put .opblock-summary-method {
    background: #ed8936;
}

/* DELETE operations */
.swagger-ui .opblock.opblock-delete {
    background: rgba(245, 101, 101, 0.04);
    border-color: #f56565;
}

.swagger-ui .opblock.opblock-delete .opblock-summary-method {
    background: #f56565;
}

/* Method badges */
.swagger-ui .opblock .opblock-summary-method {
    border-radius: 6px;
    font-weight: 600;
    font-size: 12px;
    padding: 6px 12px;
    min-width: 70px;
    text-align: center;
}

/* Parameters */
.swagger-ui .parameter__name {
    font-weight: 600;
    color: #2d3748;
}

.swagger-ui .parameter__name.required::after {
    color: #f56565;
    font-size: 12px;
}

/* Models */
.swagger-ui section.models {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 16px;
}

.swagger-ui section.models .model-container {
    background: #f7fafc;
    border-radius: 6px;
    padding: 12px;
    margin-bottom: 8px;
}

/* Try it out button */
.swagger-ui .try-out__btn {
    border: 2px solid #4361ee;
    color: #4361ee;
}

.swagger-ui .try-out__btn:hover {
    background: #4361ee;
    color: white;
}

/* Execute button */
.swagger-ui .btn.execute {
    background-color: #4361ee;
    border-color: #4361ee;
}

.swagger-ui .btn.execute:hover {
    background-color: #3651d4;
}

/* Response */
.swagger-ui .responses-inner h4 {
    color: #2d3748;
}

.swagger-ui .response-col_status {
    color: #2d3748;
    font-weight: 600;
}

/* Brand watermark */
.swagger-ui .topbar .topbar-wrapper::after {
    content: "AI Helpdesk";
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
    margin-left: 16px;
    font-weight: 500;
}

/* Wrapper */
.swagger-ui .wrapper {
    padding: 0 40px;
    max-width: 1400px;
    margin: 0 auto;
}

/* Table styling */
.swagger-ui table thead tr td,
.swagger-ui table thead tr th {
    color: #2d3748;
    font-weight: 600;
    border-bottom: 2px solid #e2e8f0;
}

/* Error container */
.swagger-ui .errors-information {
    border: 1px solid #fc8181;
    border-radius: 8px;
}

/* Info section */
.swagger-ui .info {
    margin: 24px 0;
    padding: 24px;
    background: #f7fafc;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
}

/* Server selector */
.swagger-ui .servers {
    margin: 16px 0;
}

.swagger-ui .servers select {
    border: 2px solid #e2e8f0;
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 13px;
}
"""

SWAGGER_UI_DARK_CSS = """
/* AI Helpdesk Swagger UI Dark Theme - Corporate Dark Mode */

/* Base background */
.swagger-ui {
    color: #e2e8f0;
}

/* Main background */
html,
.swagger-ui .information-container.wrapper {
    background: #0f172a;
}

.swagger-ui .info .title {
    color: #e2e8f0;
}

.swagger-ui .info .description p {
    color: #94a3b8;
}

/* Header bar */
.swagger-ui .topbar {
    background-color: #020617;
    border-bottom: 3px solid #4361ee;
}

/* Info section */
.swagger-ui .info {
    background: #1e293b;
    border-color: #334155;
    margin: 24px 0;
    padding: 24px;
    border-radius: 12px;
}

/* Section tags */
.swagger-ui .opblock-tag {
    color: #e2e8f0;
    border-bottom-color: #334155;
}

.swagger-ui .opblock-tag:hover {
    color: #60a5fa;
    border-bottom-color: #4361ee;
}

.swagger-ui .opblock-tag noop {
    color: #94a3b8;
}

/* Operation blocks */
.swagger-ui .opblock {
    border-radius: 8px;
    border: 1px solid #334155;
    background: #1e293b;
    margin-bottom: 12px;
}

.swagger-ui .opblock .opblock-summary {
    border-bottom-color: #334155;
}

/* GET */
.swagger-ui .opblock.opblock-get {
    background: rgba(34, 197, 94, 0.05);
    border-color: #22c55e;
}

.swagger-ui .opblock.opblock-get .opblock-summary-method {
    background: #16a34a;
}

/* POST */
.swagger-ui .opblock.opblock-post {
    background: rgba(59, 130, 246, 0.05);
    border-color: #3b82f6;
}

.swagger-ui .opblock.opblock-post .opblock-summary-method {
    background: #2563eb;
}

/* PUT */
.swagger-ui .opblock.opblock-put {
    background: rgba(234, 179, 8, 0.05);
    border-color: #eab308;
}

.swagger-ui .opblock.opblock-put .opblock-summary-method {
    background: #ca8a04;
}

/* DELETE */
.swagger-ui .opblock.opblock-delete {
    background: rgba(239, 68, 68, 0.05);
    border-color: #ef4444;
}

.swagger-ui .opblock.opblock-delete .opblock-summary-method {
    background: #dc2626;
}

/* PATCH */
.swagger-ui .opblock.opblock-patch {
    background: rgba(168, 85, 247, 0.05);
    border-color: #a855f7;
}

.swagger-ui .opblock.opblock-patch .opblock-summary-method {
    background: #9333ea;
}

/* Method badge */
.swagger-ui .opblock .opblock-summary-method {
    border-radius: 4px;
    font-weight: 600;
    font-size: 12px;
    min-width: 70px;
    text-align: center;
}

/* Description text */
.swagger-ui .opblock .opblock-summary-description {
    color: #94a3b8;
}

/* Parameter names */
.swagger-ui .parameter__name {
    color: #e2e8f0;
    font-weight: 600;
}

.swagger-ui .parameter__type {
    color: #94a3b8;
}

.swagger-ui .parameter__extension,
.swagger-ui .parameter__in {
    color: #64748b;
}

/* Table headers */
.swagger-ui table thead tr td,
.swagger-ui table thead tr th {
    color: #e2e8f0;
    border-bottom-color: #334155;
}

.swagger-ui table tbody tr td {
    color: #cbd5e1;
}

/* Response */
.swagger-ui .responses-inner h4 {
    color: #e2e8f0;
}

.swagger-ui .response-col_status {
    color: #e2e8f0;
}

.swagger-ui .response-col_description {
    color: #cbd5e1;
}

/* Models section */
.swagger-ui section.models {
    border-color: #334155;
    background: #1e293b;
    border-radius: 8px;
}

.swagger-ui section.models .model-container {
    background: #0f172a;
    border-radius: 6px;
}

.swagger-ui .model {
    color: #e2e8f0;
}

.swagger-ui .model .property {
    color: #94a3b8;
}

.swagger-ui .model .property .property-name {
    color: #60a5fa;
}

/* Model title */
.swagger-ui .model-box {
    color: #e2e8f0;
}

.swagger-ui .model-title {
    color: #e2e8f0;
}

/* Buttons */
.swagger-ui .btn {
    border-color: #475569;
    color: #e2e8f0;
}

.swagger-ui .btn:hover {
    background: #334155;
}

.swagger-ui .try-out__btn {
    border-color: #3b82f6;
    color: #60a5fa;
}

.swagger-ui .try-out__btn:hover {
    background: #3b82f6;
    color: white;
}

.swagger-ui .btn.execute {
    background: #3b82f6;
    border-color: #3b82f6;
}

.swagger-ui .btn.execute:hover {
    background: #2563eb;
}

.swagger-ui .btn.cancel {
    color: #f87171;
    border-color: #f87171;
}

/* Inputs */
.swagger-ui input[type=text],
.swagger-ui select {
    background: #0f172a;
    border-color: #475569;
    color: #e2e8f0;
}

.swagger-ui textarea {
    background: #0f172a !important;
    color: #e2e8f0 !important;
    border-color: #475569 !important;
}

/* Select */
.swagger-ui select {
    background: #1e293b;
    color: #e2e8f0;
}

/* Markdown */
.swagger-ui .markdown p,
.swagger-ui .markdown li {
    color: #cbd5e1;
}

.swagger-ui .markdown code {
    background: #1e293b;
    color: #e2e8f0;
}

/* Response header */
.swagger-ui .response-controls {
    color: #e2e8f0;
}

/* Highlight code */
.swagger-ui .highlight-code {
    background: #0f172a;
}

.swagger-ui .highlight-code .language-json {
    background: #0f172a;
}

/* Scrollbar */
.swagger-ui .opblock-body pre {
    background: #0f172a !important;
}

/* Server selector */
.swagger-ui .servers select {
    background: #1e293b;
    border-color: #475569;
    color: #e2e8f0;
}

.swagger-ui .servers label {
    color: #94a3b8;
}

/* Info table */
.swagger-ui .info .info-table td {
    color: #94a3b8;
}

/* Links */
.swagger-ui a {
    color: #60a5fa;
}

.swagger-ui a:hover {
    color: #93c5fd;
}

/* Errors */
.swagger-ui .errors-information {
    border-color: #ef4444;
    background: rgba(239, 68, 68, 0.05);
}

/* Loading */
.swagger-ui .loading-container {
    color: #94a3b8;
}

/* Topbar watermark */
.swagger-ui .topbar .topbar-wrapper::after {
    content: "AI Helpdesk";
    color: rgba(255, 255, 255, 0.5);
    font-size: 14px;
    margin-left: 16px;
    font-weight: 500;
}

/* Wrapper */
.swagger-ui .wrapper {
    padding: 0 40px;
    max-width: 1400px;
    margin: 0 auto;
}
"""

SWAGGER_UI_CUSTOM_JS = """
(function() {
    'use strict';

    // ---- Environment selector ----
    function addEnvSelector() {
        var infoEl = document.querySelector('.swagger-ui .info');
        if (!infoEl) return;

        var container = document.createElement('div');
        container.style.cssText = 'margin-top: 16px; display: flex; align-items: center; gap: 8px;';

        var label = document.createElement('label');
        label.textContent = 'Environment:';
        label.style.cssText = 'font-weight: 600; font-size: 13px; color: #4a5568;';

        var selector = document.createElement('select');
        selector.style.cssText = 'padding: 6px 12px; border: 2px solid #e2e8f0; border-radius: 6px; font-size: 13px; background: white; cursor: pointer;';

        var envUrls = {
            local: 'http://localhost:8000',
            staging: 'https://staging-api.helpdesk.ai',
            production: 'https://api.helpdesk.ai'
        };

        Object.keys(envUrls).forEach(function(env) {
            var opt = document.createElement('option');
            opt.value = env;
            opt.textContent = env.charAt(0).toUpperCase() + env.slice(1) + ' (' + envUrls[env] + ')';
            selector.appendChild(opt);
        });

        selector.addEventListener('change', function() {
            var env = this.value;
            var baseUrl = envUrls[env] || envUrls.local;
            if (window._swaggerUi) {
                window._swaggerUi.specActions.updateUrl(baseUrl + '/openapi.json');
                window._swaggerUi.specActions.download();
            }
        });

        container.appendChild(label);
        container.appendChild(selector);

        // Insert after the description
        var desc = infoEl.querySelector('.description');
        if (desc && desc.nextSibling) {
            infoEl.insertBefore(container, desc.nextSibling);
        } else {
            infoEl.appendChild(container);
        }
    }

    // ---- Theme toggle ----
    function addThemeToggle() {
        var topbar = document.querySelector('.swagger-ui .topbar .topbar-wrapper');
        if (!topbar) return;

        var toggleBtn = document.createElement('button');
        toggleBtn.textContent = '🌙 Dark';
        toggleBtn.style.cssText = 'margin-left: auto; padding: 4px 12px; border: 1px solid rgba(255,255,255,0.3); border-radius: 4px; background: transparent; color: rgba(255,255,255,0.8); cursor: pointer; font-size: 12px;';

        // Read dark CSS from the hidden data element
        var darkDataEl = document.getElementById('swagger-dark-data');
        var darkCSS = darkDataEl ? darkDataEl.textContent.replace(/^"/, '').replace(/"$/, '') : '';

        // Check if dark theme is already set via query param
        var isDark = window.location.search.includes('theme=dark');
        function applyTheme(dark) {
            var cssLink = document.getElementById('swagger-theme-css');
            if (!cssLink) {
                cssLink = document.createElement('style');
                cssLink.id = 'swagger-theme-css';
                document.head.appendChild(cssLink);
            }
            cssLink.textContent = dark ? darkCSS : '';
            toggleBtn.textContent = dark ? '☀️ Light' : '🌙 Dark';
        }

        applyTheme(isDark);

        toggleBtn.addEventListener('click', function() {
            var currentlyDark = toggleBtn.textContent.includes('☀️');
            applyTheme(!currentlyDark);
            var url = new URL(window.location);
            if (!currentlyDark) {
                url.searchParams.set('theme', 'dark');
            } else {
                url.searchParams.delete('theme');
            }
            window.history.replaceState({}, '', url);
        });

        topbar.appendChild(toggleBtn);
    }

    // Wait for DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(addEnvSelector, 1500);
            setTimeout(addThemeToggle, 1500);
        });
    } else {
        setTimeout(addEnvSelector, 1500);
        setTimeout(addThemeToggle, 1500);
    }
})();

// Auto-collapse models section on load
setTimeout(function() {
    var models = document.querySelector('.swagger-ui section.models');
    if (models) {
        var toggle = models.querySelector('h4');
        if (toggle) {
            toggle.click();
        }
    }
}, 500);
"""
