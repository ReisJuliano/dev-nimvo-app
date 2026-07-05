export const CASH_REGISTER_PAYMENT_FIELDS = [
    { key: 'cash', label: 'Dinheiro', icon: 'cash', tone: 'cash' },
    { key: 'pix', label: 'Pix', icon: 'pix', tone: 'pix' },
    { key: 'debit_card', label: 'Cartao de debito', icon: 'card', tone: 'card' },
    { key: 'credit_card', label: 'Cartao de credito', icon: 'card', tone: 'card' },
    { key: 'check', label: 'Cheque', icon: 'wallet', tone: 'check' },
    { key: 'credit', label: 'Fiado', icon: 'wallet', tone: 'credit' },
]

export function createOpenCashRegisterForm(tillId = '') {
    return {
        openingAmount: '0',
        openingNotes: '',
        tillId: tillId ? String(tillId) : '',
    }
}

export function buildCloseCashRegisterModal(report) {
    return {
        report,
        step: 'informing',
        supervisorPromptOpen: false,
        supervisorUserId: '',
        supervisorPassword: '',
        supervisorError: '',
        supervisorAuthorizing: false,
        supervisorName: '',
        form: {
            notes: report.cashRegister.closing_notes || '',
            amounts: {
                cash: '',
                pix: '',
                debit_card: '',
                credit_card: '',
                check: '',
                credit: '',
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
                systemVisible: closeModal.step === 'revealed',
            }
        })
}
