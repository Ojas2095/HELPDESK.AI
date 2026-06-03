/* eslint-disable no-unused-vars */
/* global describe, beforeEach, cy, it, expect, Cypress */

/**
 * cy.login(email, password) — full UI login flow.
 */
Cypress.Commands.add('login', (email, password) => {
  cy.visit('/login');
  cy.get('input[type="email"]').type(email);
  cy.get('input[type="password"]').type(password);
  cy.get('button[type="submit"]').click();
  cy.url().should('not.include', '/login');
});

/**
 * cy.loginAsAdmin() — authenticate as an admin user.
 *
 * Uses environment variables for credentials so they never appear in source:
 *   CYPRESS_ADMIN_EMAIL    (default: test-admin@helpdesk.ai)
 *   CYPRESS_ADMIN_PASSWORD (default: testpassword)
 *
 * If CYPRESS_SESSION_TOKEN is set, the session is restored via localStorage
 * to skip the UI login flow and speed up tests.
 */
Cypress.Commands.add('loginAsAdmin', () => {
  const sessionToken = Cypress.env('SESSION_TOKEN');

  if (sessionToken) {
    // Restore session from token — skip UI login
    cy.session('admin-session', () => {
      cy.window().then((win) => {
        win.localStorage.setItem('supabase.auth.token', sessionToken);
      });
    });
    return;
  }

  const email = Cypress.env('ADMIN_EMAIL') || 'test-admin@helpdesk.ai';
  const password = Cypress.env('ADMIN_PASSWORD') || 'testpassword';

  cy.session(
    ['admin', email],
    () => {
      cy.visit('/login');

      // Wait for the login form to be ready
      cy.get('input[type="email"], input[name="email"]', { timeout: 10000 })
        .should('be.visible')
        .type(email);

      cy.get('input[type="password"], input[name="password"]')
        .should('be.visible')
        .type(password, { log: false });

      cy.get('button[type="submit"]').click();

      // Verify login succeeded — admin lands on /admin or /login-success
      cy.url({ timeout: 15000 }).should('not.include', '/login');
    },
    {
      cacheAcrossSpecs: true,
    }
  );
});

/**
 * cy.loginAsUser() — authenticate as a regular user for user-facing tests.
 */
Cypress.Commands.add('loginAsUser', () => {
  const email = Cypress.env('USER_EMAIL') || 'test-user@helpdesk.ai';
  const password = Cypress.env('USER_PASSWORD') || 'testpassword';

  cy.session(
    ['user', email],
    () => {
      cy.visit('/login');
      cy.get('input[type="email"], input[name="email"]', { timeout: 10000 })
        .should('be.visible')
        .type(email);
      cy.get('input[type="password"], input[name="password"]')
        .should('be.visible')
        .type(password, { log: false });
      cy.get('button[type="submit"]').click();
      cy.url({ timeout: 15000 }).should('not.include', '/login');
    },
    { cacheAcrossSpecs: true }
  );
});

/**
 * cy.interceptApiAndStub(route, fixture) — stub an API endpoint with fixture data.
 * Useful for offline / CI testing without a live backend.
 */
Cypress.Commands.add('interceptApiAndStub', (route, fixture) => {
  cy.intercept('GET', route, { fixture }).as(`stub_${route.replace(/\W/g, '_')}`);
  cy.intercept('POST', route, { fixture }).as(`stub_post_${route.replace(/\W/g, '_')}`);
});

/**
 * cy.waitForPageReady() — wait until the page is stable (no spinners / skeletons).
 */
Cypress.Commands.add('waitForPageReady', () => {
  cy.get('[data-testid="loading"], .animate-pulse, .skeleton', { timeout: 500 })
    .should('not.exist')
    .or(() => cy.wait(500));
});
