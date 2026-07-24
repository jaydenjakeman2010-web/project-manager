# How to Put This Website Live

This guide assumes you have never deployed a website before. Follow every step in order.

---

## What We're Building

A task manager website where people can sign in with Google or GitHub, create projects, manage tasks, and invite team members. The data lives in a database (PostgreSQL) on the cloud.

---

## Part 1: Create a GitHub Account

If you don't already have one:

1. Go to https://github.com
2. Click "Sign up"
3. Enter your email, create a password, pick a username
4. Verify your email address

---

## Part 2: Push the Code to GitHub

This takes the code from your computer and uploads it to the internet.

**Step 2.1 — Create a new repository on GitHub**

1. In your browser, go to https://github.com/new
2. For "Repository name" type: `project-manager`
3. Leave everything else as-is
4. Click "Create repository"
5. You'll see a page with commands. **Copy the first block titled "...or push an existing repository"**. It looks like:

```
git remote add origin https://github.com/jaydenjakeman2010-web/project-manager.git
git branch -M main
git push -u origin main
```

**Step 2.2 — Upload your code**

1. Open **PowerShell** (search for it in your Start Menu)
2. Type this command to go to your project folder:

```powershell
cd "C:\Users\Jayde\Downloads\Project Manager Website"
```

3. Press Enter
4. Now paste the three commands you copied from GitHub. It should look like:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/project-manager.git
git branch -M main
git push -u origin main
```

5. It will ask for your GitHub username and password. Your password is NOT your normal password — you need a "personal access token" instead:
   - Go to https://github.com/settings/tokens
   - Click "Generate new token (classic)"
   - Give it a name like "push"
   - Check the box next to **repo**
   - Scroll down and click "Generate token"
   - **Copy the token** (it looks like `ghp_xxxxxxxxxxxx`)
   - When PowerShell asks for a password, paste this token instead

6. If it worked, you'll see "Success" or similar. Your code is now on the internet.

---

## Part 3: Deploy on Railway (The Hosting Service)

Railway runs your website on the internet 24/7.

**Step 3.1 — Create a Railway account**

1. Go to https://railway.app
2. Click "Start a New Project" or "Sign in with GitHub"
3. Click "Sign in with GitHub" — this connects Railway to your GitHub
4. Give permission when GitHub asks
5. Complete your Railway account setup

**Step 3.2 — Create the project**

1. Click "New Project"
2. Click "Deploy from GitHub repo"
3. Find and click your `project-manager` repo
4. Wait 30 seconds — Railway is building your code

**Step 3.3 — Add a database**

1. In Railway, click the **+** (plus) button
2. Click "Database"
3. Click "Add PostgreSQL"
4. Wait for it to finish adding (takes ~20 seconds)
5. Railway automatically connects the database to your app — you don't need to do anything

You now have a live website. It will have a URL like `https://project-manager.up.railway.app`. Click the URL to open it.

**BUT** sign-in won't work yet — you need to set up Google and/or GitHub login first (next step). The login buttons will only appear after you finish Part 4 and/or Part 5.

**You only need ONE provider.** If you only set up Google, only the Google button appears. If you only set up GitHub, only the GitHub button appears. If you set up both, both buttons appear.

---

## Part 4: Set Up Google Login

**Step 4.1 — Go to Google Cloud Console**

1. Go to https://console.cloud.google.com
2. Sign in with your Google account
3. Accept the terms if asked
4. Click "Select a project" at the top → "New Project"
5. Name it `Project Manager` → Click "Create"
6. Make sure "Project Manager" is selected at the top

**Step 4.2 — Enable the API**

1. In the search bar at the top, type "OAuth" and click "OAuth consent screen"
2. Choose "External" → Click "Create"
3. For "App name" type: `Project Manager`
4. For "User support email" choose your email
5. For "Developer contact information" type your email
6. Click "Save and Continue"
7. Click "Add or Remove Scopes"
8. Check the boxes: `.../auth/userinfo.email` and `.../auth/userinfo.profile`
9. Click "Update" → "Save and Continue"
10. Click "Add Users" → type your email → "Add"
11. Click "Save and Continue"
12. You can ignore the "Summary" page — just click "Back to Dashboard"

**Step 4.3 — Create credentials**

1. On the left menu (hamburger icon top-left if hidden), click "Credentials"
2. Click "Create Credentials" at the top → "OAuth client ID"
3. For "Application type" choose "Web application"
4. For "Name" type: `Project Manager Web`
5. Under "Authorized redirect URIs", click "Add URI"
6. Type: `https://project-manager.up.railway.app/api/auth/google/callback`
   - **IMPORTANT:** Replace `project-manager.up.railway.app` with your actual Railway URL
7. Click "Create"
8. A popup will show your **Client ID** and **Client Secret**. These are your Google login keys. **Copy both** somewhere safe (a text file is fine for now).

**Step 4.4 — Add those keys to Railway**

1. Go back to Railway in your browser
2. Click your project
3. Click the "Variables" tab (or look for a key icon)
4. Click "New Variable"
5. For the key, type: `GOOGLE_CLIENT_ID`
6. For the value, paste your Client ID
7. Click "Add"
8. Repeat: add `GOOGLE_CLIENT_SECRET` with your Client Secret
9. Repeat: add `GOOGLE_CALLBACK_URL` with: `https://project-manager.up.railway.app/api/auth/google/callback`

---

## Part 5: Set Up GitHub Login

**Step 5.1 — Create a GitHub OAuth App**

1. Go to https://github.com/settings/developers
2. Click "OAuth Apps" on the left
3. Click "New OAuth App"
4. For "Application name" type: `Project Manager`
5. For "Homepage URL" type your Railway URL (like `https://project-manager.up.railway.app`)
6. For "Authorization callback URL" type: `https://project-manager.up.railway.app/api/auth/github/callback`
7. Click "Register application"
8. You'll see a "Client ID" — copy it
9. Click "Generate a new client secret" → copy the secret that appears

**Step 5.2 — Add these to Railway**

Back in Railway → Variables tab, add:
- `GITHUB_CLIENT_ID` = (the Client ID you just copied)
- `GITHUB_CLIENT_SECRET` = (the secret you just copied)
- `GITHUB_CALLBACK_URL` = `https://project-manager.up.railway.app/api/auth/github/callback`

---

## Part 6: Set a Secret Key (Security)

This is like a master password your server uses to create login tokens.

1. Open PowerShell on your computer
2. Type:
```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
3. A long random string will appear. Copy it.
4. In Railway → Variables tab, add:
   - `JWT_SECRET` = (the random string you just copied)
   - `NODE_ENV` = `production`
   - `CORS_ORIGIN` = your Railway URL (like `https://project-manager.up.railway.app`)

---

## Part 7: Restart and Test

1. In Railway, go to the "Deployments" tab
2. Click "Redeploy" (this makes it use the new settings)
3. Wait ~30 seconds for it to build and start
4. Click your URL to open the site
5. You should see a "Sign In" screen with Google and GitHub buttons
6. Click one to test — it should take you through the login flow and back to your app

---

## Common Problems

**"Something went wrong" when signing in**
- Check that your callback URLs exactly match. The most common mistake is `google` vs `google` (typo) or missing `/api/auth/` in the path.
- In Google Cloud Console → Credentials → click your OAuth client → check the redirect URI matches EXACTLY.

**"Application error" on first load**
- Go to Railway → Deployments tab → click the failed deployment → "View logs"
- Look for red error text. Common issues: missing `DATABASE_URL` (add Postgres plugin), missing `JWT_SECRET`.

**The page looks unstyled (no CSS)**
- Hard refresh: hold Ctrl and click the refresh button (or press Ctrl+F5)

**I changed the code on my computer — how do I update the live site?**
```powershell
cd "C:\Users\Jayde\Downloads\Project Manager Website"
git add -A
git commit -m "describe your change here"
git push
```
Railway will automatically rebuild and redeploy.

---

## Your Railway URL / Custom Domain

Your site is at `https://PROJECT-NAME.up.railway.app`. To use a custom domain like `mytasks.com`:

1. In Railway, click your project
2. Go to "Settings" tab → "Domains"
3. Type your domain and follow Railway's instructions (you'll need to update DNS settings at your domain registrar)

---

## Cost

Railway has a free tier. The Postgres database and one service are free. The free tier sleeps after inactivity (takes ~10 seconds to wake up on first visit).
