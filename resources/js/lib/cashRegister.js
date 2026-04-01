export const CASH_REGISTER_PAYMENT_FIELDS = [
    { key: 'cash', label: 'Dinheiro' },
    { key: 'pix', label: 'Pix' },
    { key: 'debit_card', label: 'Cartao de debito' },
    { key: 'credit_card', label: 'Cartao de credito' },
    { key: 'credit', label: 'A Prazo' },
]

export function createOpenCashRegisterForm() {
    return {
        openingAmount: '0',
        openingNotes: '',
    }
}

export function buildCloseCashRegisterModal(report) {
    const paymentTotals = Object.fromEntries(report.payments.map((payment) => [payment.payment_method, Number(payment.total || 0)]))

    return {
        report,
        form: {
            notes: report.cashRegister.closing_notes || '',
            amounts: {
                cash: '',
                pix: String(Number(paymentTotals.pix || 0).toFixed(2)),
                debit_card: String(Number(paymentTotals.debit_card || 0).toFixed(2)),
                credit_card: String(Number(paymentTotals.credit_card || 0).toFixed(2)),
                credit: String(Number(paymentTotals.credit || 0).toFixed(2)),
            },
        },
    }
}

export function buildCloseCashRegisterRows(closeModal, requireConference) {
    if (!closeModal?.report) {
        return []
    }

    const paymentTotals = Object.fromEntries(closeModal.report.payments.map((payment) => [payment.payment_method, Number(payment.total || 0)]))

    return CASH_REGISTER_PAYMENT_FIELDS
        .filter((field) => requireConference || field.key === 'cash')
        .map((field) => {
            const expected = field.key === 'cash'
                ? Number(closeModal.report.expected_cash || 0)
                : Number(paymentTotals[field.key] || 0)
            const rawInformed = closeModal.form.amounts[field.key]
            const informed = rawInformed === '' ? null : Number(rawInformed || 0)

            return {
                ...field,
                expected,
                informed,
                difference: informed === null ? null : informed - expected,
            }
        })
}
