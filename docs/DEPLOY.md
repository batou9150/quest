# Deploying to Google Cloud

One-time setup, then every push to `main` deploys through GitHub Actions (`.github/workflows/deploy.yml`).

Replace the values in the first block, then run the commands in order.

```bash
PROJECT_ID=your-project-id
REGION=europe-west1
GITHUB_REPO=your-github-user/quest           # owner/name
PUBLIC_URL=https://quest-xxxxx.europe-west1.run.app   # or your custom domain, set after the first deploy
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
gcloud config set project $PROJECT_ID
```

## 1. APIs, Firestore, image registry

```bash
gcloud services enable run.googleapis.com firestore.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com iamcredentials.googleapis.com sts.googleapis.com

# The location cannot be changed later.
gcloud firestore databases create --location=$REGION --type=firestore-native

# Delete expired login sessions automatically.
gcloud firestore fields ttls update expiresAt --collection-group=sessions --enable-ttl

gcloud artifacts repositories create quest --repository-format=docker --location=$REGION
```

## 2. Service accounts

```bash
# Runtime identity of the Cloud Run service: Firestore read/write only.
gcloud iam service-accounts create quest-runtime --display-name="Quest runtime"
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:quest-runtime@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/datastore.user

# Identity used by GitHub Actions to build and deploy.
gcloud iam service-accounts create quest-deployer --display-name="Quest deployer"
for role in roles/run.admin roles/artifactregistry.writer; do
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:quest-deployer@$PROJECT_ID.iam.gserviceaccount.com" --role=$role
done
gcloud iam service-accounts add-iam-policy-binding quest-runtime@$PROJECT_ID.iam.gserviceaccount.com \
  --member="serviceAccount:quest-deployer@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/iam.serviceAccountUser
```

## 3. GitHub → Google Cloud without keys (Workload Identity Federation)

Only workflows of your repository, on `main`, can use the deployer account.

```bash
gcloud iam workload-identity-pools create github --location=global --display-name="GitHub"
gcloud iam workload-identity-pools providers create-oidc quest-repo \
  --location=global --workload-identity-pool=github \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository == '$GITHUB_REPO' && assertion.ref == 'refs/heads/main'"

gcloud iam service-accounts add-iam-policy-binding quest-deployer@$PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/$GITHUB_REPO"
```

## 4. OAuth apps and secrets

- **Google**: Google Cloud console → APIs & Services → Credentials → *OAuth client ID* (Web application). Authorized redirect URI: `$PUBLIC_URL/auth/google/callback`. Configure the consent screen (scopes: openid, email, profile).
- **GitHub**: Settings → Developer settings → *OAuth Apps* → New. Callback URL: `$PUBLIC_URL/auth/github/callback`.

```bash
printf '%s' 'GOOGLE_SECRET_VALUE' | gcloud secrets create google-client-secret --data-file=-
printf '%s' 'GITHUB_SECRET_VALUE' | gcloud secrets create github-client-secret --data-file=-
for s in google-client-secret github-client-secret; do
  gcloud secrets add-iam-policy-binding $s \
    --member="serviceAccount:quest-runtime@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/secretmanager.secretAccessor
done
```

The callback URLs depend on `PUBLIC_URL`. If you only know the Cloud Run URL after the first deploy, deploy once, then create the OAuth apps and update `PUBLIC_URL`.

## 5. GitHub repository settings

*Settings → Secrets and variables → Actions → Variables* (these are not secret):

| Variable | Example |
|---|---|
| `GCP_PROJECT_ID` | `your-project-id` |
| `GCP_WIF_PROVIDER` | `projects/123456789/locations/global/workloadIdentityPools/github/providers/quest-repo` |
| `GCP_DEPLOY_SA` | `quest-deployer@your-project-id.iam.gserviceaccount.com` |
| `PUBLIC_URL` | `https://quest.example.com` |
| `ADMIN_EMAILS` | `you@example.com` |
| `GOOGLE_CLIENT_ID` | `…apps.googleusercontent.com` |
| `GITHUB_CLIENT_ID` | `Ov23li…` |

Also:
- *Settings → Environments*: create `production` (optionally require your approval).
- *Settings → Actions → General*: "Require approval for all outside collaborators" for fork pull requests.
- *Settings → Code security*: enable secret scanning with push protection, and Dependabot alerts.

## 6. Cost guard

```bash
gcloud billing budgets create --billing-account=YOUR_BILLING_ACCOUNT \
  --display-name="quest" --budget-amount=20EUR \
  --threshold-rule=percent=0.5 --threshold-rule=percent=0.9 --threshold-rule=percent=1.0
```

## 7. First deploy and first admin

Push to `main` (or run the Deploy workflow by hand). The demo levels and the starter guides from `content/guides/` are added at startup when missing (`SEED_DEMO=true`). Log in on the site with an email listed in `ADMIN_EMAILS`: you get the admin role. Then, from the API Access page, generate an API key and upload levels:

```bash
QUEST_URL=$PUBLIC_URL QUEST_API_KEY=qk_... npm run levels:push -- ../quest-levels/*.json --publish
```

## Custom domain (optional)

```bash
gcloud beta run domain-mappings create --service=quest --domain=quest.example.com --region=$REGION
```

Then add the DNS records it prints, set `PUBLIC_URL` to the new domain, and update both OAuth callback URLs.
