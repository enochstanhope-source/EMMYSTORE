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
# EMMYSTORE