class StripeInvoiceDocumentProvider {
    getInvoiceLink(invoice) {
        return invoice.hostedInvoiceUrl || invoice.invoicePdf || '';
    }
}

class ZohoInvoiceDocumentProvider {
    getInvoiceLink(invoice) {
        return invoice.zohoInvoiceUrl || '';
    }
}

module.exports = {
    StripeInvoiceDocumentProvider,
    ZohoInvoiceDocumentProvider
};
