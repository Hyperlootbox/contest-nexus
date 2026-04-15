# Contest Nexus

## Run locally

Start the local rewrite-aware server:

```powershell
node server.js
```

Or choose a custom port:

```powershell
node server.js 8000
```

Then open:

- `http://localhost:3000/`
- `http://localhost:3000/search`
- `http://localhost:3000/problems/fermat-2021-06`

## Deploy on Netlify

This repo includes `netlify.toml`, which rewrites clean URLs like `/search` and `/problems/<id>` to the correct HTML files.

Steps:

1. Push the repo to GitHub.
2. Sign in to Netlify with GitHub.
3. Choose `Add new site` -> `Import an existing project`.
4. Select this repository.
5. Leave the build command empty.
6. Make sure the publish directory is `.` if Netlify asks.
7. Deploy the site.

After deploy, test:

- `/`
- `/search`
- `/problems/fermat-2021-06`

Future updates are easy: push to GitHub again and Netlify will redeploy automatically.
