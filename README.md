# MetaTax Account

MetaTax Account is a lightweight workspace for collecting company bills and preparing records for an income-tax return.

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:3000`. Uploaded files are stored in `data/uploads` and their metadata is tracked in `data/documents.json`.

Supported uploads are PDF, JPG, PNG, WebP, XLSX, and CSV files up to 15 MB.

ITR OTP email delivery uses `MetaCashAudit@outlook.com`. For an Outlook.com mailbox, configure `SMTP_HOST=smtp-mail.outlook.com`, `SMTP_PORT=587`, `SMTP_SECURE=false`, `SMTP_USER`, and `SMTP_PASSWORD` on Render. Without these values, local/demo mode displays the OTP for testing. Authenticated SMTP must be enabled for the mailbox, and an app password may be required.

## Deploy

The included `render.yaml` deploys the Express server on Render. For production use, attach persistent storage or replace the local file store with a database and object storage so uploaded records survive instance replacement.
