const db = require('../db/db');

function getFinancialYearString(date = new Date()) {
  const d = new Date(date);
  const month = d.getMonth() + 1; // 1-12
  const fullYear = d.getFullYear();
  
  let startYear, endYear;
  if (month >= 4) { // April onwards
    startYear = fullYear % 100;
    endYear = (fullYear + 1) % 100;
  } else {
    startYear = (fullYear - 1) % 100;
    endYear = fullYear % 100;
  }
  
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(startYear)}-${pad(endYear)}`;
}

function generateInternalBillId(branchCode = 'RAI') {
  const mem = db.getMemoryStore();
  const bills = mem.bills || [];
  const fy = getFinancialYearString();
  const code = (branchCode || 'RAI').toUpperCase();

  // Find bills for this branch and financial year
  const prefix = `${code}/${fy}/`;
  const matching = bills.filter(b => b.internal_bill_id && b.internal_bill_id.startsWith(prefix));
  
  let nextSeq = 458; // Realistic start sequence
  if (matching.length > 0) {
    const seqNumbers = matching.map(b => {
      const parts = b.internal_bill_id.split('/');
      return parseInt(parts[parts.length - 1], 10) || 0;
    });
    nextSeq = Math.max(...seqNumbers) + 1;
  } else if (bills.length > 0) {
    nextSeq = 458 + bills.length;
  }

  const padded = String(nextSeq).padStart(6, '0');
  return `${code}/${fy}/${padded}`;
}

module.exports = {
  getFinancialYearString,
  generateInternalBillId
};
