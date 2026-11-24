# BEE-7B Collective Team Finance — Firebase version

This version uses **Firebase Authentication (email + password)** and **Cloud Firestore**. No Supabase, email confirmation, email OTP, SMS or authenticator setup is required for normal sign-in. Firebase's optional password-reset feature sends an email link if a user requests a reset.

## Before publishing: important security steps

1. Firebase Console → Firestore Database → Data: confirm the `users` collection contains a document whose **document ID exactly equals** the Firebase Authentication UID `sgq62BLcTjbzcB5h4HFIkJ1CYDk1`. Confirm the fields `role` (string) = `owner` and `approved` (boolean) = `true`, and that this UID belongs to `zubairkalwar01@gmail.com`. Do not add an Owner profile for any other UID.
2. Firebase Console → Firestore Database → Rules: **replace the previous starter rules entirely** with the contents of `firestore.rules`, then click **Publish**. The earlier rules allowed overly broad writes and are NOT appropriate for the production site.
3. Firebase Console → Authentication → Settings → Authorized domains: add the exact Netlify hostname of the deployed site (for example `your-site.netlify.app`) if it is not already listed. Do not include `https://` or paths.
4. Firebase Console → Authentication → Sign-in method: Email/Password must be enabled. Other providers can remain enabled if you want, but this website only uses email/password.

## Publish

Upload **the contents of the `site` folder** to Netlify Drop, or upload the `site` folder as your deployment directory. `site/index.html` is the website entry point. Do not upload the whole project folder as the site root.

The Firebase web app configuration is in `site/config.js`. These are public Firebase client identifiers, not server secrets. Never put service-account credentials or passwords in this file.

## First sign-in

1. On the Netlify site, click **Admin Portal**.
2. Sign in as `zubairkalwar01@gmail.com` with the **password created in Firebase Authentication**, not the previous Supabase password or the previously shared admin password.
3. On the first approved Owner sign-in, the app creates the initial groups, 26 roster members, and projects in Firestore. It does not overwrite the roster once initialized.
4. In the Admin dashboard, use Approvals to link each new member registration to their roster entry. Each member creates their own account using **Create member account**. No verification email is sent.
5. Approved members can view financial records; approved admins can manage transactions, projects, groups and member details. Only the Owner can grant admin roles.

## Real-time updates

The app listens to a Firestore `system/revision` document and refreshes dashboard data when an admin makes changes through the site. If you manually edit database records in Firebase Console, the site may not update until reload because Console edits do not update the revision document.

## Important limitations

- This is a **Firebase migration of the existing site**, not a security audit or production certification. Test with a separate non-admin account before entering actual financial data.
- A financial transaction and its 26 expense-share records are committed in one Firestore batch. Shares are calculated client-side. Security rules restrict writes to admins but do not independently validate the arithmetic; for stronger financial integrity, use a trusted server or Cloud Function.
- Admins can void (not delete) ledger entries in the website. Client-side edit history is limited; this is not an immutable accounting audit log.
- Password reset via email is optional; without email access a user cannot self-service recover a forgotten password. Admins cannot read or recover Firebase passwords.
- For a serious financial system, deploy automated tests, backups and server-side accounting validations before relying on it for real funds.
