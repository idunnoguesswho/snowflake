/* HSMS shared acknowledgement / form-save engine — DS Home Computing
   Provides: real client-side PDF generation with an auto-computed filename
   (no print dialog), and localStorage-backed "signed within 350 days" memory. */
(function (global) {
  const SIGNOFF_WINDOW_DAYS = 350;
  const STORE_KEY = 'hsmsAckLog';

  function today() { return new Date().toISOString().slice(0, 10); }
  function slug(s) { return (s || '').trim().replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '-'); }
  function daysAgo(dateStr) {
    const then = new Date(dateStr + 'T00:00:00');
    const now = new Date(today() + 'T00:00:00');
    return Math.round((now - then) / 86400000);
  }

  function readLog() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); }
    catch (e) { return {}; }
  }
  function writeLog(log) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(log)); } catch (e) {}
  }
  function logKey(docCode, signerName) {
    return docCode + '::' + slug(signerName).toLowerCase();
  }
  function recordSignoff(docCode, signerName, filename) {
    const log = readLog();
    log[logKey(docCode, signerName)] = { name: signerName, date: today(), filename };
    writeLog(log);
  }
  function lookupSignoff(docCode, signerName) {
    if (!signerName || !signerName.trim()) return null;
    const rec = readLog()[logKey(docCode, signerName)];
    if (!rec) return null;
    const age = daysAgo(rec.date);
    if (age > SIGNOFF_WINDOW_DAYS) return null;
    return Object.assign({}, rec, { daysAgo: age });
  }

  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-vendor="' + src + '"]');
      if (existing) { existing.dataset.loaded === '1' ? resolve() : existing.addEventListener('load', resolve); return; }
      const s = document.createElement('script');
      s.src = src; s.dataset.vendor = src;
      s.onload = () => { s.dataset.loaded = '1'; resolve(); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  let vendorReady = null;
  function ensureVendor(vendorPath) {
    if (!vendorReady) {
      vendorReady = Promise.all([
        loadScriptOnce(vendorPath + 'jspdf.umd.min.js'),
        loadScriptOnce(vendorPath + 'html2canvas.min.js')
      ]);
    }
    return vendorReady;
  }

  /* Render a DOM element to a paginated PDF and trigger a real download
     with the given filename — no print dialog, no location prompt. */
  async function savePdfFromElement(el, filename, vendorPath) {
    await ensureVendor(vendorPath || '../vendor/');
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'pt', 'a4');
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;
    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    let heightLeft = imgH;
    let position = 0;
    pdf.addImage(imgData, 'JPEG', 0, position, imgW, imgH);
    heightLeft -= pageH;
    while (heightLeft > 0) {
      position = heightLeft - imgH;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgW, imgH);
      heightLeft -= pageH;
    }
    pdf.save(filename);
  }

  global.HsmsAck = {
    SIGNOFF_WINDOW_DAYS, today, slug, recordSignoff, lookupSignoff,
    savePdfFromElement, ensureVendor
  };
})(window);
