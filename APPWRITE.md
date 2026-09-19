# Appwrite setup

Project ID: `6aaef293000dca2bdf33`
Endpoint: `https://cloud.appwrite.io/v1`

## Required in Appwrite Console

1. Open project → **Auth** → **Settings**
2. **Add platform** → **Web**
   - Hostname: `localhost`
   - Hostname: your Vercel domain, e.g. `samgtu.vercel.app` (without https://)
3. Enable **Email/Password** auth
4. Password minimum **8 characters**

## Deploy site files

Upload to repo root:
- `index.html` (main app with Appwrite project ID)
- `data/seed.json`
- `data/watch.json`
- `data/magistr.json`

Or replace single-file `index.html` from LifeHub_ONEFILE.zip (all-in-one).

After push, Vercel redeploys automatically if the project is linked to this repo.
