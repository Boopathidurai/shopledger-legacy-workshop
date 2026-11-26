var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

function riceLine() {
  return {
    id: 1,
    name: 'Rice',
    sku: 'RICE-5KG',
    hsn: '1006',
    price: 1000,
    qty: 1
  };
}

test('invoice uses the same HSN rate and post-discount taxable amount as billing', function () {
  var items = [riceLine()];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.deepEqual({
    subtotal: printed.subtotal,
    discount: printed.discount,
    tax: printed.tax,
    cgst: printed.cgst,
    sgst: printed.sgst,
    total: printed.total
  }, {
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    cgst: billed.cgst,
    sgst: billed.sgst,
    total: billed.total
  });
  assert.equal(printed.rows[0].gstPercent, 5);
  assert.equal(printed.rows[0].lineTax, 45);
  assert.equal(printed.total, 945);
});

test('invoice interprets decimal gstRate the same way as billing', function () {
  var items = [{
    id: 2,
    name: 'Explicit rate item',
    price: 1000,
    qty: 1,
    gstRate: 0.05
  }];
  var billed = pricing.computeTotals(items, '');
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.total, billed.total);
  assert.equal(printed.rows[0].gstPercent, 5);
});

test('GST reconciliation matches the ledger after invoice calculations use billing rules', function () {
  var items = [riceLine()];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var db = {
    products: [],
    customers: [],
    orders: [{
      id: 42,
      date: '2026-11-26',
      customer: 'Test customer',
      status: 'completed',
      items: items,
      coupon: 'SAVE10',
      subtotal: billed.subtotal,
      discount: billed.discount,
      tax: billed.tax,
      total: billed.total
    }]
  };

  assert.deepEqual(reports.getGstReconciliation(db), {
    totalChecked: 1,
    mismatchCount: 0,
    totalDelta: 0,
    rows: [{
      orderId: 42,
      date: '2026-11-26',
      customer: 'Test customer',
      coupon: 'SAVE10',
      ledgerSubtotal: 1000,
      ledgerDiscount: 100,
      ledgerTax: 45,
      ledgerTotal: 945,
      invoiceDiscount: 100,
      invoiceTax: 45,
      invoiceTotal: 945,
      delta: 0,
      matched: true
    }]
  });
});
