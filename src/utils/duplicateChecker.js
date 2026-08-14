const db = require('../db/db');

function checkDuplicateBill(vendorId, invoiceNumber, invoiceAmount, excludeBillId = null) {
  const mem = db.getMemoryStore();
  const bills = mem.bills || [];
  const vendors = mem.vendors || [];

  const cleanInvoiceNo = String(invoiceNumber || '').trim().toLowerCase();
  const numAmount = parseFloat(invoiceAmount) || 0;
  const numVendorId = parseInt(vendorId, 10);

  const matched = bills.find(b => {
    if (excludeBillId && b.id == excludeBillId) return false;
    const sameVendor = parseInt(b.vendor_id, 10) === numVendorId;
    const sameInvoice = String(b.invoice_number || '').trim().toLowerCase() === cleanInvoiceNo;
    const sameAmount = Math.abs(parseFloat(b.invoice_amount) - numAmount) < 0.01;
    return sameVendor && sameInvoice && sameAmount;
  });

  if (matched) {
    const vendor = vendors.find(v => v.id === matched.vendor_id);
    return {
      isDuplicate: true,
      matchedBill: {
        id: matched.id,
        internal_bill_id: matched.internal_bill_id,
        invoice_number: matched.invoice_number,
        invoice_amount: matched.invoice_amount,
        invoice_date: matched.invoice_date,
        status: matched.status,
        vendor_name: vendor ? (vendor.trade_name || vendor.legal_name) : 'Vendor',
        created_at: matched.created_at
      },
      warningMessage: `Possible Duplicate Invoice Detected! An existing bill (${matched.internal_bill_id}) with Invoice No "${matched.invoice_number}" for ₹${parseFloat(matched.invoice_amount).toLocaleString('en-IN')} already exists in the system.`
    };
  }

  return {
    isDuplicate: false,
    matchedBill: null,
    warningMessage: null
  };
}

module.exports = {
  checkDuplicateBill
};
