// Convert the main content to a PDF, upload it to the local upload server, and redirect to WhatsApp
 (function() {
  const PHONE_NUMBER = '2349162919586'; // target number (no plus sign). Hardcoded as requested.
  const UPLOAD_ENDPOINT = 'http://localhost:3001/upload'; // change if your server uses a different host/port
  const EXPORT_BTN_ID = 'export-share-wa';
  const EXPORT_EL = document.getElementById(EXPORT_BTN_ID);

  // Create minimal UI Feedback elements
  function createLoader() {
    let loader = document.getElementById('share-loader');
    if (loader) return loader;
    loader = document.createElement('div');
    loader.id = 'share-loader';
    loader.setAttribute('role','status');
    loader.style.position = 'fixed';
    loader.style.right = '12px';
    loader.style.bottom = '80px';
    loader.style.background = 'rgba(0,0,0,0.75)';
    loader.style.color = '#fff';
    loader.style.padding = '10px 12px';
    loader.style.borderRadius = '8px';
    loader.style.zIndex = 99999;
    loader.style.fontSize = '13px';
    loader.style.display = 'none';
    document.body.appendChild(loader);
    return loader;
  }

  const LOADER = createLoader();

  if (!EXPORT_EL) return; // nothing to do

  async function generatePdfBlob(targetEl) {
    // Use html2pdf library to return a Blob
    // We assume html2pdf is already loaded (we include via CDN in index.html)
    if (typeof html2pdf === 'undefined') {
      throw new Error('html2pdf not loaded');
    }
    const opt = {
      margin:       8,
      filename:     'emmystore.pdf',
      image:        { type: 'jpeg', quality: 0.95 },
      html2canvas:  { scale: 2, useCORS: true, logging: false },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    // html2pdf returns a Promise when using `from().toPdf()` flow
    return new Promise((resolve, reject) => {
      try {
        const worker = html2pdf().set(opt).from(targetEl);
        worker.toPdf().output('blob').then(blob => {
          resolve(blob);
        }).catch(err => reject(err));
      } catch (err) { reject(err); }
    });
  }

  async function uploadBlob(blob, filename) {
    const form = new FormData();
    form.append('file', blob, filename || 'emmystore.pdf');
    const resp = await fetch(UPLOAD_ENDPOINT, {
      method: 'POST',
      body: form
    });
    if (!resp.ok) throw new Error('Upload failed: ' + resp.status);
    return resp.json(); // expects { url }
  }

  async function convertAndShare() {
    try {
      EXPORT_EL.disabled = true;
      LOADER.textContent = 'Generating PDF...';
      LOADER.style.display = 'block';
      const target = document.querySelector('.main-content') || document.body;
      const blob = await generatePdfBlob(target);
      LOADER.textContent = 'Uploading PDF...';
      // Optionally show a preview or save locally before uploading
      const fileName = `emmystore-${Date.now()}.pdf`;
      const uploadResp = await uploadBlob(blob, fileName);
      if (!uploadResp || !uploadResp.url) throw new Error('Invalid upload response');
      // After upload, redirect the user to WhatsApp (wa.me) with the uploaded file URL in the message.
      try {
        LOADER.textContent = 'Opening WhatsApp...';
        LOADER.style.display = 'block';
        const uploadedUrl = uploadResp.url;
        if (!uploadedUrl) throw new Error('Upload returned no URL');
        const message = `Here's the PDF from EmmyStore: ${uploadedUrl}`;
        const waUrl = `https://wa.me/${PHONE_NUMBER}?text=${encodeURIComponent(message)}`;
        // Give the user a short moment to see the loader, then redirect
        setTimeout(() => {
          try {
            window.location.href = waUrl;
          } catch (err) {
            console.error('Redirect to WhatsApp failed', err);
            LOADER.textContent = 'Redirect failed';
            setTimeout(() => { LOADER.style.display = 'none'; LOADER.textContent = ''; }, 3000);
          }
        }, 250);
        return;
      } catch (err) {
        console.error('Could not redirect to WhatsApp:', err);
        LOADER.style.display = 'block';
        LOADER.textContent = 'Redirect failed: ' + (err && err.message ? err.message : err);
        setTimeout(() => { LOADER.style.display = 'none'; LOADER.textContent = ''; }, 5000);
        return;
      }
    } catch (err) {
      alert('Error while generating or sharing PDF: ' + (err.message || err));
      LOADER.style.display = 'none';
      LOADER.textContent = '';
    } finally {
      EXPORT_EL.disabled = false;
    }
  }

  EXPORT_EL.addEventListener('click', function(e) {
    e.preventDefault();
    convertAndShare();
  });
})();
