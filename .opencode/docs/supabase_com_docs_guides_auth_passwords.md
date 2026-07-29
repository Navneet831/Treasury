# Password-based Auth | Supabase Docs

> Source: https://supabase.com/docs/guides/auth/passwords
> Cached: 2026-07-20T12:33:20.957Z

---

# Password-based Auth

Allow users to sign in with a password connected to their email or phone number.

Users often expect to sign in to your site with a password. Supabase Auth helps you implement password-based auth safely, using secure configuration options and best practices for storing and verifying passwords.

Users can associate a password with their identity using their [email address](#with-email) or a [phone number](#with-phone).

## With email[#](#with-email)

### Enabling email and password-based authentication[#](#enabling-email-and-password-based-authentication)

Email authentication is enabled by default.

You can configure whether users need to verify their email to sign in. On hosted Supabase projects, this is true by default. On self-hosted projects or in local development, this is false by default.

Change this setting on the [Auth Providers page](/dashboard/project/_/auth/providers) for hosted projects, or in the [configuration file](/docs/guides/cli/config#auth.email.enable_confirmations) for self-hosted projects.

### Signing up with an email and password[#](#signing-up-with-an-email-and-password)

There are two possible flows for email signup: [implicit flow](/docs/guides/auth/sessions#implicit-flow) and [PKCE flow](/docs/guides/auth/sessions#pkce-flow). If you&#x27;re using SSR, you&#x27;re using the PKCE flow. If you&#x27;re using client-only code, the default flow depends upon the client library. The implicit flow is the default in JavaScript and Dart, and the PKCE flow is the default in Swift.

The instructions in this section assume that email confirmations are enabled.

Implicit flowPKCE flowThe implicit flow only works for client-only apps. Your site directly receives the access token after the user confirms their email.

JavaScriptDartSwiftKotlinPythonTo sign up the user, call [signUp()](/docs/reference/javascript/auth-signup) with their email address and password.

You can optionally specify a URL to redirect to after the user clicks the confirmation link. This URL must be configured as a [Redirect URL](/docs/guides/auth/redirect-urls), which you can do in the [dashboard](/dashboard/project/_/auth/url-configuration) for hosted projects, or in the [configuration file](/docs/guides/cli/config#auth.additional_redirect_urls) for self-hosted projects.

If you don&#x27;t specify a redirect URL, the user is automatically redirected to your site URL. This defaults to `localhost:3000`, but you can also configure this.

```
1import { createClient } from &#x27;@supabase/supabase-js&#x27;23const supabase = createClient(&#x27;https://your-project-id.supabase.co&#x27;, &#x27;sb_publishable_...&#x27;)45// ---cut---6async function signUpNewUser() {7  const { data, error } = await supabase.auth.signUp({8    email: &#x27;valid.email@supabase.io&#x27;,9    password: &#x27;example-password&#x27;,10    options: {11      emailRedirectTo: &#x27;https://example.com/welcome&#x27;,12    },13  })14}
```

### Signing in with an email and password[#](#signing-in-with-an-email-and-password)

JavaScriptDartSwiftKotlinPythonWhen your user signs in, call [`signInWithPassword()`](/docs/reference/javascript/auth-signinwithpassword) with their email address and password:

```
1import { createClient } from &#x27;@supabase/supabase-js&#x27;23const supabase = createClient(&#x27;https://your-project-id.supabase.co&#x27;, &#x27;sb_publishable_...&#x27;)45// ---cut---6async function signInWithEmail() {7  const { data, error } = await supabase.auth.signInWithPassword({8    email: &#x27;valid.email@supabase.io&#x27;,9    password: &#x27;example-password&#x27;,10  })11}
```

### Resetting a password[#](#resetting-a-password)

Implicit flowPKCE flow#### Step 1: Create a reset password page[#](#step-1-create-a-reset-password-page)

Create a **reset password** page. This page should be publicly accessible.

Collect the user&#x27;s email address and request a password reset email. Specify the redirect URL, which should point to the URL of a **change password** page. This URL needs to be configured in your [redirect URLs](/docs/guides/auth/redirect-urls).

JavaScriptSwiftKotlinPythonDart```
1import { createClient } from &#x27;@supabase/supabase-js&#x27;23const supabase = createClient(&#x27;https://your-project-id.supabase.co&#x27;, &#x27;sb_publishable_...&#x27;)45// ---cut---6await supabase.auth.resetPasswordForEmail(&#x27;valid.email@supabase.io&#x27;, {7  redirectTo: &#x27;http://example.com/account/update-password&#x27;,8})
```

#### Step 2: Create a change password page[#](#step-2-create-a-change-password-page)

Create a **change password** page at the URL you specified in the previous step. This page should be accessible only to authenticated users.

Collect the user&#x27;s new password and call `updateUser` to update their password.

JavaScriptSwiftKotlinPythonDart```
1import { createClient } from &#x27;@supabase/supabase-js&#x27;23const supabase = createClient(&#x27;https://your-project-id.supabase.co&#x27;, &#x27;sb_publishable_...&#x27;)45// ---cut---6await supabase.auth.updateUser({ password: &#x27;new_password&#x27; })
```

#### Verifying the current password[#](#verifying-the-current-password)

If your app requires users to confirm their current password before setting a new one, you can pass `current_password` (available in `supabase-js` v2.102.0+ and `supabase-kt` 3.5.0+):

JavaScriptKotlin```
1await supabase.auth.updateUser({2  password: &#x27;new_password&#x27;,3  current_password: &#x27;old_password&#x27;,4})
```

### Email sending[#](#email-sending)

The signup confirmation and password reset flows require an SMTP server to send emails.

The Supabase platform comes with a default email-sending service for you to try out. The service has a rate limit of 2 emails per hour, and availability is on a best-effort basis. For production use, you should consider configuring a custom SMTP server.

Consider configuring a custom SMTP server for production.

See the [Custom SMTP guide](/docs/guides/auth/auth-smtp) for instructions.

#### Local development with Mailpit[#](#local-development-with-mailpit)

You can test email flows on your local machine. The Supabase CLI automatically captures emails sent locally by using [Mailpit](https://github.com/axllent/mailpit).

In your terminal, run `supabase status` to get the Mailpit URL. Go to this URL in your browser, and follow the instructions to find your emails.

## With phone[#](#with-phone)

You can use a user&#x27;s mobile phone number as an identifier, instead of an email address, when they sign up with a password.

This practice is usually discouraged because phone networks recycle mobile phone numbers. Anyone receiving a recycled phone number gets access to the original user&#x27;s account. To mitigate this risk, [implement MFA](/docs/guides/auth/auth-mfa).

Protect users who use a phone number as a password-based auth identifier by enabling MFA.

### Enabling phone and password-based authentication[#](#enabling-phone-and-password-based-authentication)

Enable phone authentication on the [Auth Providers page](/dashboard/project/_/auth/providers) for hosted Supabase projects.

For self-hosted projects or local development, use the [configuration file](/docs/guides/cli/config#auth.sms.enable_signup). See the configuration variables namespaced under `auth.sms`.

If you want users to confirm their phone number on signup, you need to set up an SMS provider. Each provider has its own configuration. Supported providers include MessageBird, Twilio, Vonage, and TextLocal (community-supported).

### Configuring SMS Providers

##### MessageBird

##### Twilio

##### Vonage

##### Textlocal (Community Supported)

To keep SMS sending costs under control, make sure you adjust your project&#x27;s rate limits and [configure CAPTCHA](/docs/guides/auth/auth-captcha). See the [Production Checklist](/docs/guides/platform/going-into-prod) to learn more.

Some countries have special regulations for services that send SMS messages to users, (e.g India&#x27;s TRAI DLT regulations). Remember to look up and follow the regulations of countries where you operate.

### Signing up with a phone number and password[#](#signing-up-with-a-phone-number-and-password)

To sign up the user, call [`signUp()`](/docs/reference/javascript/auth-signup) with their phone number and password:

JavaScriptSwiftKotlinPythonDartHTTP```
1import { createClient } from &#x27;@supabase/supabase-js&#x27;23const supabase = createClient(&#x27;https://your-project-id.supabase.co&#x27;, &#x27;sb_publishable_...&#x27;)45// ---cut---6const { data, error } = await supabase.auth.signUp({7  phone: &#x27;+13334445555&#x27;,8  password: &#x27;some-password&#x27;,9})
```

If you have phone verification turned on, the user receives an SMS with a 6-digit pin that you must verify within 60 seconds:

JavaScriptSwiftKotlinPythonDartHTTPYou should present a form to the user so they can input the 6 digit pin, then send it along with the phone number to `verifyOtp`:

```
1import { createClient } from &#x27;@supabase/supabase-js&#x27;23const supabase = createClient(&#x27;https://your-project-id.supabase.co&#x27;, &#x27;sb_publishable_...&#x27;)45// ---cut---6const {7  data: { session },8  error,9} = await supabase.auth.verifyOtp({10  phone: &#x27;+13334445555&#x27;,11  token: &#x27;123456&#x27;,12  type: &#x27;sms&#x27;,13})
```

### Signing in a with a phone number and password[#](#signing-in-a-with-a-phone-number-and-password)

Call the function to sign in with the user&#x27;s phone number and password:

JavaScriptSwiftKotlinPythonDartHTTP```
1import { createClient } from &#x27;@supabase/supabase-js&#x27;23const supabase = createClient(&#x27;https://your-project-id.supabase.co&#x27;, &#x27;sb_publishable_...&#x27;)45// ---cut---6const { data, error } = await supabase.auth.signInWithPassword({7  phone: &#x27;+13334445555&#x27;,8  password: &#x27;some-password&#x27;,9})
```

[Edit this page on GitHub ](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/passwords.mdx)