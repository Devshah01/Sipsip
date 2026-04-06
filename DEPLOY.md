# 🚀 SipSip Deployment Guide

Complete guide to deploy SipSip to production.

| Layer     | Service              |
|-----------|----------------------|
| Frontend  | Cloudflare Pages     |
| Backend   | Google Cloud Run     |
| Database  | MongoDB Atlas        |
| Domain    | Cloudflare DNS       |

---

## 1. MongoDB Atlas

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) → Create a **free M0 cluster**
2. **Database Access** → Add a database user (username + password)
3. **Network Access** → Add `0.0.0.0/0` (allow from anywhere — required for Cloud Run's dynamic IPs)
4. **Connect** → Choose "Connect your application" → Copy the connection string
5. Replace `<password>` in the string:
   ```
   mongodb+srv://youruser:yourpassword@cluster0.xxxxx.mongodb.net/sipsip?retryWrites=true&w=majority
   ```

---

## 2. Google Cloud Run (Backend)

### Prerequisites
- Install [Google Cloud CLI](https://cloud.google.com/sdk/docs/install)
- Create a GCP project and enable **Cloud Run** and **Artifact Registry** APIs

### Deploy

```bash
# 1. Authenticate
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT_ID

# 2. Create Artifact Registry repo (first time only)
gcloud artifacts repositories create sipsip-repo \
  --repository-format=docker \
  --location=asia-south1 \
  --description="SipSip Docker images"

# 3. Build & push the Docker image
cd backend
gcloud builds submit --tag asia-south1-docker.pkg.dev/YOUR_GCP_PROJECT_ID/sipsip-repo/sipsip-backend:latest

# 4. Deploy to Cloud Run
gcloud run deploy sipsip-backend \
  --image asia-south1-docker.pkg.dev/YOUR_GCP_PROJECT_ID/sipsip-repo/sipsip-backend:latest \
  --region asia-south1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/sipsip?retryWrites=true&w=majority" \
  --set-env-vars "JWT_SECRET=your_strong_random_secret" \
  --set-env-vars "JWT_EXPIRE=7d" \
  --set-env-vars "GOOGLE_CLIENT_ID=your_google_client_id" \
  --set-env-vars "GOOGLE_CLIENT_SECRET=your_google_client_secret" \
  --set-env-vars "GOOGLE_CALLBACK_URL=https://YOUR_CLOUD_RUN_URL/api/auth/google/callback" \
  --set-env-vars "CLIENT_URL=https://yourdomain.com" \
  --set-env-vars "SMTP_HOST=smtp.gmail.com" \
  --set-env-vars "SMTP_PORT=587" \
  --set-env-vars "SMTP_SECURE=false" \
  --set-env-vars "SMTP_USER=your_email@gmail.com" \
  --set-env-vars "SMTP_PASS=your_app_password" \
  --set-env-vars "VAPID_PUBLIC_KEY=your_vapid_public_key" \
  --set-env-vars "VAPID_PRIVATE_KEY=your_vapid_private_key" \
  --set-env-vars "VAPID_EMAIL=mailto:admin@yourdomain.com"
```

After deployment, you'll get a URL like:
```
https://sipsip-backend-xxxxx-el.a.run.app
```

> **Tip:** You can also set env vars in the [Cloud Run Console](https://console.cloud.google.com/run) → your service → Edit → Variables.

---

## 3. Cloudflare Pages (Frontend)

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create**
2. Connect your **GitHub repository**
3. Configure the build:

   | Setting           | Value               |
   |-------------------|---------------------|
   | Framework preset  | None                |
   | Build command     | `cd frontend && npm install && npm run build` |
   | Build output dir  | `frontend/dist`     |
   | Root directory    | `/`   (leave default)  |

4. **Environment Variables** → Add:

   | Variable        | Value                                          |
   |-----------------|-------------------------------------------------|
   | `VITE_API_URL`  | `https://sipsip-backend-xxxxx-el.a.run.app/api` |
   | `NODE_VERSION`  | `22`                                            |

5. Click **Save and Deploy**

> The `_redirects` file in `public/` handles SPA routing automatically.

---

## 4. Custom Domain (Cloudflare)

1. In Cloudflare dashboard → **Workers & Pages** → your project → **Custom domains**
2. Add your domain (e.g., `sipsip.app` or `www.sipsip.app`)
3. Cloudflare will auto-configure the DNS CNAME record
4. SSL is automatic via Cloudflare

---

## 5. Post-Deploy Checklist

After everything is live, update these values:

### In Google Cloud Run env vars:
- `CLIENT_URL` → `https://yourdomain.com` (your actual domain)
- `GOOGLE_CALLBACK_URL` → `https://sipsip-backend-xxxxx-el.a.run.app/api/auth/google/callback`

### In Google Cloud Console (OAuth):
- Go to [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
- Edit your OAuth 2.0 Client ID
- Add to **Authorized redirect URIs**:
  ```
  https://sipsip-backend-xxxxx-el.a.run.app/api/auth/google/callback
  ```
- Add to **Authorized JavaScript origins**:
  ```
  https://yourdomain.com
  ```

### Smoke Test:
- [ ] `curl https://YOUR_CLOUD_RUN_URL/` returns `{"success":true,...}`
- [ ] Frontend loads at `https://yourdomain.com`
- [ ] Sign up / login with email works
- [ ] Google OAuth login works
- [ ] Water tracking works
- [ ] Push notifications work

---

## Re-deploying

### Backend
```bash
cd backend
gcloud builds submit --tag asia-south1-docker.pkg.dev/YOUR_GCP_PROJECT_ID/sipsip-repo/sipsip-backend:latest
gcloud run deploy sipsip-backend \
  --image asia-south1-docker.pkg.dev/YOUR_GCP_PROJECT_ID/sipsip-repo/sipsip-backend:latest \
  --region asia-south1
```

### Frontend
Push to GitHub → Cloudflare Pages auto-deploys on every push.
