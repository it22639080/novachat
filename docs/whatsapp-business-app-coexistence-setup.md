# WhatsApp Business App Coexistence Setup

This guide is for connecting a client phone number that is already active in the WhatsApp Business mobile app while keeping the app usable and enabling NovaChat AI replies through the official WhatsApp Cloud API.

Do not use Meta Production Setup -> Add phone number for this case. That flow is for adding/migrating a number into Cloud API directly, and Meta will reject an already registered WhatsApp/WhatsApp Business App number with:

> This phone number is already registered to a WhatsApp account.

For existing WhatsApp Business App numbers, use Meta's official WhatsApp Business App onboarding / coexistence path through Facebook Login for Business Embedded Signup.

## Current NovaChat Support

NovaChat supports two WhatsApp connection paths:

- Manual Cloud API setup: Advanced fallback for an already provisioned Cloud API phone number, Phone Number ID, WABA ID, and token.
- Embedded Signup: Client-facing one-click onboarding through Meta.

For coexistence, the important part is the Meta configuration behind `META_CONFIG_ID`. NovaChat can launch the configured flow and process the result, but Meta decides whether the popup shows "Connect your existing WhatsApp Business app" based on that Facebook Login for Business configuration and the client's eligibility.

After this update, NovaChat exposes and logs:

- Active Meta App ID.
- Active Meta Config ID.
- Whether coexistence onboarding is enabled in NovaChat.
- Optional Meta Embedded Signup feature type.
- Received Embedded Signup session events.
- Returned WABA ID.
- Returned Phone Number ID.
- Onboarding errors.

NovaChat never logs or returns Meta access tokens to the frontend.

## Environment Variables

API service:

```env
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
META_CONFIG_ID=your_facebook_login_for_business_config_id
META_API_VERSION=v20.0
META_REDIRECT_URI=https://novachat-dashboard.vercel.app/settings
META_WEBHOOK_VERIFY_TOKEN=your_verify_token
META_SYSTEM_USER_ACCESS_TOKEN=optional_backend_only_system_user_token
META_EMBEDDED_SIGNUP_ENABLED=true
META_COEXISTENCE_ONBOARDING_ENABLED=true
META_EMBEDDED_SIGNUP_FEATURE_TYPE=whatsapp_business_app_onboarding
```

Dashboard:

```env
NEXT_PUBLIC_API_URL=https://novachat-api-production-a673.up.railway.app/api/v1
```

For WhatsApp Business App coexistence, set `META_EMBEDDED_SIGNUP_FEATURE_TYPE=whatsapp_business_app_onboarding`. NovaChat also defaults to this value when `META_COEXISTENCE_ONBOARDING_ENABLED=true`, but keeping it explicit in Railway makes production diagnostics clearer.

## Meta Dashboard Configuration

1. Open [Meta Developers](https://developers.facebook.com/).
2. Select your NovaChat Meta app.
3. Go to App settings -> Basic.
4. Add these App domains:
   - `novachat-dashboard.vercel.app`
   - `novachat-api-production-a673.up.railway.app`
5. Set a real HTTPS Privacy Policy URL and Terms URL.
6. Go to Facebook Login for Business -> Settings.
7. Enable Client OAuth login.
8. Enable Web OAuth login.
9. Enable Login with the JavaScript SDK.
10. Add Valid OAuth Redirect URIs:
    - `https://novachat-dashboard.vercel.app/settings`
    - `https://novachat-dashboard.vercel.app/settings/`
11. Add Allowed Domains for the JavaScript SDK:
    - `novachat-dashboard.vercel.app`
12. Save changes.

## Create The Correct Configuration ID

1. Go to Facebook Login for Business -> Configurations.
2. Create a new configuration or edit an existing one.
3. Choose the WhatsApp Embedded Signup / WhatsApp Business Platform product.
4. Select the option that supports onboarding an existing WhatsApp Business App number or coexistence, if your app has that option.
5. Select access-token type according to your Meta setup. For SaaS onboarding, the token must be handled by the backend only.
6. Include WhatsApp permissions:
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
7. If available for your app/use case, include business management access. Some newer Meta dashboards hide this behind app use cases or asset assignment instead of showing `business_management` directly.
8. Save the configuration.
9. Copy its Configuration ID.
10. Set that value as `META_CONFIG_ID` in Railway.
11. Set `META_COEXISTENCE_ONBOARDING_ENABLED=true` in Railway.
12. Set `META_EMBEDDED_SIGNUP_FEATURE_TYPE=whatsapp_business_app_onboarding` in Railway.
13. Redeploy/restart the API service.

## System User Token Notes

`META_SYSTEM_USER_ACCESS_TOKEN` is a backend-only fallback. It is not a replacement for the Embedded Signup session result.

If you use a system user token:

1. Open Meta Business Settings.
2. Go to Users -> System users.
3. Select the NovaChat system user.
4. Assign assets:
   - App: NovaChat app, full/manage access.
   - WhatsApp account: the relevant WABA, full/manage access.
5. Generate a token for the NovaChat app.
6. Include:
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
7. Store the token only in Railway as `META_SYSTEM_USER_ACCESS_TOKEN`.

If the API logs `Missing Permission` for `/me/businesses`, it means the token cannot discover business assets through that edge. This is not enough to complete coexistence by itself. The Embedded Signup session still needs to return WABA and phone number IDs, or the system user must have discoverable business/WABA access.

## Expected Client Popup Flow

When configured correctly, the client should see a flow similar to:

1. Click Connect WhatsApp in NovaChat.
2. Continue with Facebook.
3. Choose or create a Meta Business Portfolio.
4. Choose WhatsApp Business Platform setup.
5. Select "Connect your existing WhatsApp Business app" when Meta shows it.
6. Select the existing WhatsApp Business App phone number.
7. Complete authorization or verification steps.
8. Return to NovaChat.
9. NovaChat receives an authorization code plus WABA/phone information.
10. NovaChat exchanges the code on the backend, encrypts the token, subscribes the WABA to webhooks, runs a health check, and marks the account connected.

If the popup never shows the existing Business App option, the active `META_CONFIG_ID` is probably not a coexistence-enabled configuration or the number/business is not eligible.

## Eligibility Limitations

Meta controls eligibility. Coexistence may not be available for every:

- Country or region.
- Phone number.
- WhatsApp Business App account state.
- Meta Business Portfolio.
- App review state.
- Business verification state.
- API version or dashboard configuration.

If Meta does not offer coexistence for a number, the client may need a Meta-supported migration path instead. That is separate from NovaChat's manual setup and should be handled carefully because it can affect the mobile app experience.

## Common Errors

### "This phone number is already registered to a WhatsApp account"

You are using the wrong flow. Do not add the number from Production Setup. Use the coexistence Embedded Signup configuration.

### "Meta callback is missing phoneNumberId or wabaId"

The popup returned only an OAuth code. NovaChat did not receive the selected WhatsApp account result.

Check:

- `META_CONFIG_ID` is the coexistence/onboarding configuration ID, not a generic configuration.
- The client completed phone number selection in the popup.
- The popup did not end at a partial/cancelled state.
- The browser console shows `Meta Embedded Signup message` with `phoneNumberId` and `wabaId`.
- Meta Business App coexistence is enabled/available for the client.

### "Error validating verification code"

The backend code exchange redirect URI does not match the OAuth request.

Check:

- Railway `META_REDIRECT_URI=https://novachat-dashboard.vercel.app/settings`
- Meta Valid OAuth Redirect URIs include the exact same URL.
- Vercel dashboard is opened at the same domain.
- Redeploy Railway after changing env variables.

### "Missing Permission"

The backend system user token cannot inspect the business/WABA assets.

Check:

- The system user is assigned the app and WhatsApp account assets.
- The token includes `whatsapp_business_management` and `whatsapp_business_messaging`.
- If Meta exposes business management access for your app/use case, include it.

## Local/Production Test Checklist

1. Redeploy Railway API after changing Meta env variables.
2. Redeploy Vercel dashboard if dashboard env variables changed.
3. Open NovaChat dashboard.
4. Login as the client tenant owner.
5. Go to Settings -> WhatsApp Integration.
6. Confirm the page shows the active App ID and Config ID.
7. Click Connect WhatsApp.
8. Complete the Facebook popup.
9. In browser console, confirm:
   - `Launching Meta Embedded Signup`
   - `Meta Embedded Signup message`
   - `phoneNumberId` is present
   - `wabaId` is present
10. In Railway logs, confirm:
   - `Meta Embedded Signup callback received`
   - `hasPhoneNumberId: true`
   - `hasWabaId: true`
   - `coexistenceOnboardingEnabled: true`
11. Click Health check.
12. Confirm webhook subscription succeeds.
13. Send a WhatsApp message from a customer phone.
14. Confirm NovaChat inbox receives the webhook.
15. Enable AI auto-reply and test chatbot response.

## Manual Migration Fallback

Manual setup remains available, but it is not the solution for keeping the WhatsApp Business App usable with an already registered number. Use manual setup only when the client already has a proper Cloud API phone number, WABA ID, and access token, or when Meta has completed a supported migration.
