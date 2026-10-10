# Single sign-on (SSO)

SSO is available on the Enterprise plan.

## Supported providers

Lumen supports SAML 2.0 with Okta, Azure AD (Entra ID), Google Workspace and OneLogin. OIDC is in beta.

## Enforce SSO

After the SAML connection passes a test login, an admin can turn on **Enforce SSO**. When SSO is enforced, password logins are disabled for every member except the workspace owner, who keeps a break-glass password.

## SCIM provisioning

SCIM provisioning creates and removes members automatically. Deprovisioned members lose access within 5 minutes.
