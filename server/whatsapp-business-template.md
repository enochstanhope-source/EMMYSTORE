# WhatsApp Business API — Template Example (Server-side)

This file contains a code skeleton showing how you'd send a message with an attached media (e.g., PDF) using the WhatsApp Business Cloud API.

Note: This requires:
- A verified Facebook app and WhatsApp Business Account
- A phone number registered within the WhatsApp Business account
- A permanent token or appropriate auth

This is only a template. Replace placeholder values and secure credentials appropriately.

Example using Node.js and axios:

```js
// PUT THIS IN A SECURE SERVER, NEVER PUBLIC CLIENT
const axios = require('axios');
const fs = require('fs');

async function sendPdfToNumber(phone, pdfPath) {
  const token = process.env.WHATSAPP_TOKEN; // permanent token (never commit to git)
  const phoneId = process.env.WHATSAPP_PHONE_ID; // the ID for your number
  // Step 1: Upload media to WhatsApp (get media id)
  const form = new FormData();
  form.append('file', fs.createReadStream(pdfPath));
  const uploadUrl = `https://graph.facebook.com/v16.0/${phoneId}/media`;
  const uploadResp = await axios.post(uploadUrl, form, {
    headers: { ...form.getHeaders(), Authorization: `Bearer ${token}` }
  });
  const mediaId = uploadResp.data.id;

  // Step 2: Send media using messages endpoint
  const messageUrl = `https://graph.facebook.com/v16.0/${phoneId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'document',
    document: {
      id: mediaId,
      filename: 'emmystore.pdf'
    }
  };
  const sendResp = await axios.post(messageUrl, payload, { headers: { Authorization: `Bearer ${token}` } });
  return sendResp.data;
}

module.exports = { sendPdfToNumber };
```

Important: The above is provided as a conceptual example. You'll need to consult the WhatsApp Cloud API docs for the exact payload and supported file sizes and use a production-friendly auth approach and error handling.
