# EMMYSTORE

Small demo store used for demonstrating features in this workshop.

## PDF Conversion & WhatsApp Sharing (Local Dev)

This project includes a small Node/Express upload server used to accept generated PDF files and return a public URL, which is then opened in WhatsApp chat to a specified number.

To run the upload server:

```powershell
cd server
npm install
npm start
```

This will start a server on port 3001 by default. The client will attempt to upload generated PDFs to `http://localhost:3001/upload`.

How the feature works:
- Click the `Export & Share PDF` button in the footer to convert the visible page into a PDF.
- The PDF is uploaded to the local server and a public URL is returned.
- The browser opens WhatsApp to the number +2349162919586 with a message containing the PDF link.

Note: Programmatically attaching a file to WhatsApp using the user-facing `wa.me` link is not supported by WhatsApp. We instead share a public URL to the uploaded PDF. To attach a PDF programmatically you'd need the WhatsApp Business API and appropriate credentials.

WhatsApp Business API integration (optional):
If you need to programmatically send media (like PDF files) to a specific WhatsApp number without user interaction, you must use the WhatsApp Business Cloud API. This requires:
- A verified Facebook/Meta app and WhatsApp Business account
- A valid access token and a registered phone number ID
- Following their message and media upload endpoints and abiding by message templates (for first-time contact)

Refer to `server/whatsapp-business-template.md` for a basic example and guidance. The example is a template and requires valid account credentials.

### Server-side send endpoint

We added a server endpoint that attempts to send an uploaded PDF to a phone number using the WhatsApp Cloud API.

- Endpoint: `POST /send-whatsapp` (JSON body)
- Body: `{ "filename": "<filename from /upload response>", "to": "2349162919586" }` (the `to` field is optional — defaults to +2349162919586)
- Environment variables required for real send:
	- `WHATSAPP_TOKEN` - a valid Cloud API Bearer token
	- `WHATSAPP_PHONE_ID` - the phone ID for your WhatsApp business number

If the environment variables are not present the server will simulate a send (returns `simulated: true`) so you can test the UX without credentials.

Warning: WhatsApp will only deliver messages if the recipient has previously consented and the Business API is configured correctly.
# EMMYSTORE