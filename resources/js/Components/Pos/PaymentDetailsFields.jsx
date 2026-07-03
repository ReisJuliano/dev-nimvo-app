export default function PaymentDetailsFields({ method, details = {}, onChange }) {
    if (method === 'debit_card' || method === 'credit_card') {
        return (
            <div className="pos-payment-details pos-modal-section">
                <label className="pos-field">
                    <span>Bandeira</span>
                    <input
                        className="pos-field-input"
                        value={details.brand || ''}
                        onChange={(event) => onChange('brand', event.target.value)}
                        placeholder="Visa, Master, Elo..."
                    />
                </label>
                {method === 'credit_card' ? (
                    <label className="pos-field">
                        <span>Parcelas</span>
                        <input
                            className="pos-field-input"
                            type="number"
                            min="1"
                            max="24"
                            value={details.installments || '1'}
                            onChange={(event) => onChange('installments', event.target.value)}
                        />
                    </label>
                ) : null}
                <label className="pos-field">
                    <span>NSU</span>
                    <input
                        className="pos-field-input"
                        value={details.nsu || ''}
                        onChange={(event) => onChange('nsu', event.target.value)}
                        placeholder="NSU da maquininha"
                    />
                </label>
                <label className="pos-field">
                    <span>Autorizacao</span>
                    <input
                        className="pos-field-input"
                        value={details.authorization_code || ''}
                        onChange={(event) => onChange('authorization_code', event.target.value)}
                        placeholder="Codigo de autorizacao"
                    />
                </label>
            </div>
        )
    }

    if (method !== 'check') {
        return null
    }

    return (
        <div className="pos-payment-details pos-payment-details--check pos-modal-section">
            <label className="pos-field">
                <span>Banco</span>
                <input className="pos-field-input" value={details.bank || ''} onChange={(event) => onChange('bank', event.target.value)} />
            </label>
            <label className="pos-field">
                <span>Agencia</span>
                <input className="pos-field-input" value={details.agency || ''} onChange={(event) => onChange('agency', event.target.value)} />
            </label>
            <label className="pos-field">
                <span>Conta</span>
                <input className="pos-field-input" value={details.account || ''} onChange={(event) => onChange('account', event.target.value)} />
            </label>
            <label className="pos-field">
                <span>Numero</span>
                <input className="pos-field-input" value={details.check_number || ''} onChange={(event) => onChange('check_number', event.target.value)} />
            </label>
            <label className="pos-field span-2">
                <span>Emitente</span>
                <input className="pos-field-input" value={details.issuer_name || ''} onChange={(event) => onChange('issuer_name', event.target.value)} />
            </label>
            <label className="pos-field">
                <span>CPF/CNPJ</span>
                <input className="pos-field-input" value={details.issuer_document || ''} onChange={(event) => onChange('issuer_document', event.target.value)} />
            </label>
            <label className="pos-field">
                <span>Bom para</span>
                <input className="pos-field-input" type="date" value={details.deposit_date || ''} onChange={(event) => onChange('deposit_date', event.target.value)} />
            </label>
        </div>
    )
}
