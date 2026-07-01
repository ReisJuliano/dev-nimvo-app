export default function FiscalRecipientModal({
    open,
    onClose,
    documentModel,
    onDocumentModelChange,
    selectionMode,
    onSelectionModeChange,
    searchTerm,
    onSearchTermChange,
    onSearchTermSubmit,
    filteredCustomers,
    filteredCompanies,
    selectedCustomerId,
    selectedCompanyId,
    onSelectCustomer,
    onSelectCompany,
    manualRecipient,
    onManualRecipientChange,
    quickCompanyForm,
    onQuickCompanyFormChange,
    onQuickCompanyCreate,
    allowCompanySelection = true,
    creatingCompany = false,
    submitting = false,
    onSubmit,
}) {
    if (!open) {
        return null
    }

    return (
        <div className="pos-quick-customer" onClick={onClose}>
            <form className="pos-quick-customer-card pos-recipient-modal-card" onSubmit={onSubmit} onClick={(event) => event.stopPropagation()}>
                <div className="pos-quick-customer-header">
                    <div>
                        <h2>Destinatario e emissão</h2>
                        <p>{documentModel === '55' ? 'Identifique o CPF/CNPJ e o endereço antes de concluir a etapa fiscal.' : 'Escolha entre identificar o consumidor ou emitir como consumidor final não identificado.'}</p>
                    </div>
                    <button className="ui-button-ghost" type="button" onClick={onClose}>
                        Fechar
                    </button>
                </div>

                <div className="pos-recipient-model-switch">
                    <button type="button" className={documentModel === '65' ? 'active' : ''} onClick={() => onDocumentModelChange('65')}>
                        <i className="fa-solid fa-receipt" />
                        NFC-e / Cupom
                    </button>
                    <button type="button" className={documentModel === '55' ? 'active' : ''} onClick={() => onDocumentModelChange('55')}>
                        <i className="fa-solid fa-file-invoice" />
                        NF-e / DANFE
                    </button>
                </div>

                <div className="pos-recipient-mode-grid">
                    <button type="button" className={selectionMode === 'document' ? 'active' : ''} onClick={() => onSelectionModeChange('document')}>
                        <i className="fa-solid fa-id-card" />
                        Documento avulso
                    </button>
                    <button type="button" className={selectionMode === 'customer' ? 'active' : ''} onClick={() => onSelectionModeChange('customer')}>
                        <i className="fa-solid fa-user" />
                        Cliente cadastrado
                    </button>
                    {documentModel === '65' ? (
                        <button type="button" className={selectionMode === 'consumer_final' ? 'active' : ''} onClick={() => onSelectionModeChange('consumer_final')}>
                            <i className="fa-solid fa-user-secret" />
                            Não identificado
                        </button>
                    ) : null}
                    {allowCompanySelection ? (
                        <button type="button" className={selectionMode === 'company' ? 'active' : ''} onClick={() => onSelectionModeChange('company')}>
                            <i className="fa-solid fa-building" />
                            Empresa cadastrada
                        </button>
                    ) : null}
                </div>

                {selectionMode === 'document' ? (
                    <div className="pos-recipient-form-grid">
                        <label className="pos-discount-form-field">
                            Nome ou razão social
                            <input
                                className="ui-input"
                                value={manualRecipient.name}
                                onChange={(event) => onManualRecipientChange('name', event.target.value)}
                                placeholder="Digite o nome do destinatário"
                            />
                        </label>

                        <label className="pos-discount-form-field">
                            CPF ou CNPJ
                            <input
                                className="ui-input"
                                value={manualRecipient.document}
                                onChange={(event) => onManualRecipientChange('document', event.target.value)}
                                placeholder="Somente numeros"
                            />
                        </label>

                        <label className="pos-discount-form-field span-2">
                            E-mail
                            <input
                                className="ui-input"
                                type="email"
                                value={manualRecipient.email}
                                onChange={(event) => onManualRecipientChange('email', event.target.value)}
                                placeholder="Opcional"
                            />
                        </label>

                        {documentModel === '55' ? (
                            <>
                                <label className="pos-discount-form-field">
                                    Telefone
                                    <input
                                        className="ui-input"
                                        value={manualRecipient.phone}
                                        onChange={(event) => onManualRecipientChange('phone', event.target.value)}
                                        placeholder="Opcional"
                                    />
                                </label>

                                <label className="pos-discount-form-field">
                                    Inscrição estadual
                                    <input
                                        className="ui-input"
                                        value={manualRecipient.state_registration}
                                        onChange={(event) => onManualRecipientChange('state_registration', event.target.value)}
                                        placeholder="Não contribuinte se vazio"
                                    />
                                </label>

                                <label className="pos-discount-form-field span-2">
                                    Logradouro
                                    <input
                                        className="ui-input"
                                        value={manualRecipient.street}
                                        onChange={(event) => onManualRecipientChange('street', event.target.value)}
                                        placeholder="Rua, avenida, estrada"
                                    />
                                </label>

                                <label className="pos-discount-form-field">
                                    Numero
                                    <input
                                        className="ui-input"
                                        value={manualRecipient.number}
                                        onChange={(event) => onManualRecipientChange('number', event.target.value)}
                                        placeholder="Numero"
                                    />
                                </label>

                                <label className="pos-discount-form-field">
                                    Complemento
                                    <input
                                        className="ui-input"
                                        value={manualRecipient.complement}
                                        onChange={(event) => onManualRecipientChange('complement', event.target.value)}
                                        placeholder="Opcional"
                                    />
                                </label>

                                <label className="pos-discount-form-field">
                                    Bairro
                                    <input
                                        className="ui-input"
                                        value={manualRecipient.district}
                                        onChange={(event) => onManualRecipientChange('district', event.target.value)}
                                        placeholder="Bairro"
                                    />
                                </label>

                                <label className="pos-discount-form-field">
                                    Municipio
                                    <input
                                        className="ui-input"
                                        value={manualRecipient.city_name}
                                        onChange={(event) => onManualRecipientChange('city_name', event.target.value)}
                                        placeholder="Cidade"
                                    />
                                </label>

                                <label className="pos-discount-form-field">
                                    Código IBGE
                                    <input
                                        className="ui-input"
                                        value={manualRecipient.city_code}
                                        onChange={(event) => onManualRecipientChange('city_code', event.target.value)}
                                        placeholder="7 digitos"
                                    />
                                </label>

                                <label className="pos-discount-form-field">
                                    UF
                                    <input
                                        className="ui-input"
                                        value={manualRecipient.state}
                                        onChange={(event) => onManualRecipientChange('state', event.target.value)}
                                        placeholder="UF"
                                    />
                                </label>

                                <label className="pos-discount-form-field">
                                    CEP
                                    <input
                                        className="ui-input"
                                        value={manualRecipient.zip_code}
                                        onChange={(event) => onManualRecipientChange('zip_code', event.target.value)}
                                        placeholder="Somente numeros"
                                    />
                                </label>
                            </>
                        ) : null}
                    </div>
                ) : null}

                {selectionMode === 'consumer_final' ? (
                    <div className="pos-empty-state">Consumidor final sem identificaç?.</div>
                ) : null}

                {selectionMode === 'customer' ? (
                    <div className="pos-recipient-picker">
                        <div className="pos-customer-picker-search">
                            <i className="fa-solid fa-magnifying-glass" />
                            <input
                                className="ui-input pos-customer-picker-input"
                                value={searchTerm}
                                onChange={(event) => onSearchTermChange(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key !== 'Enter') {
                                        return
                                    }

                                    event.preventDefault()
                                    onSearchTermSubmit?.()
                                }}
                                placeholder="Buscar por nome ou CPF"
                                autoFocus
                            />
                            <button className="ui-button-ghost" type="button" onClick={() => onSearchTermSubmit?.()}>
                                <i className="fa-solid fa-magnifying-glass" />
                                Pesquisar
                            </button>
                        </div>

                        <div className="pos-customer-picker-list">
                            {filteredCustomers.length ? (
                                filteredCustomers.map((customer) => (
                                    <button
                                        key={customer.id}
                                        type="button"
                                        className={`pos-customer-picker-item ${String(customer.id) === String(selectedCustomerId) ? 'active' : ''}`}
                                        onClick={() => onSelectCustomer(customer)}
                                    >
                                        <span className="pos-customer-picker-item-icon">
                                            <i className="fa-solid fa-user" />
                                        </span>
                                        <span className="pos-customer-picker-item-copy">
                                            <strong>{customer.name}</strong>
                                            <small>{customer.document || customer.phone || 'Sem documento informado'}</small>
                                        </span>
                                        <span className="pos-customer-picker-item-action">
                                            {String(customer.id) === String(selectedCustomerId) ? 'Selecionado' : 'Selecionar'}
                                        </span>
                                    </button>
                                ))
                            ) : (
                                <div className="pos-empty-state">Nenhum cliente encontrado para essa busca.</div>
                            )}
                        </div>
                    </div>
                ) : null}

                {allowCompanySelection && selectionMode === 'company' ? (
                    <div className="pos-recipient-picker">
                        <div className="pos-customer-picker-search">
                            <i className="fa-solid fa-magnifying-glass" />
                            <input
                                className="ui-input pos-customer-picker-input"
                                value={searchTerm}
                                onChange={(event) => onSearchTermChange(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key !== 'Enter') {
                                        return
                                    }

                                    event.preventDefault()
                                    onSearchTermSubmit?.()
                                }}
                                placeholder="Buscar por nome ou CNPJ"
                                autoFocus
                            />
                            <button className="ui-button-ghost" type="button" onClick={() => onSearchTermSubmit?.()}>
                                <i className="fa-solid fa-magnifying-glass" />
                                Pesquisar
                            </button>
                        </div>

                        <div className="pos-customer-picker-list">
                            {filteredCompanies.length ? (
                                filteredCompanies.map((company) => (
                                    <button
                                        key={company.id}
                                        type="button"
                                        className={`pos-customer-picker-item ${String(company.id) === String(selectedCompanyId) ? 'active' : ''}`}
                                        onClick={() => onSelectCompany(company)}
                                    >
                                        <span className="pos-customer-picker-item-icon">
                                            <i className="fa-solid fa-building" />
                                        </span>
                                        <span className="pos-customer-picker-item-copy">
                                            <strong>{company.trade_name || company.name}</strong>
                                            <small>{company.document || company.email || 'Sem documento informado'}</small>
                                        </span>
                                        <span className="pos-customer-picker-item-action">
                                            {String(company.id) === String(selectedCompanyId) ? 'Selecionada' : 'Selecionar'}
                                        </span>
                                    </button>
                                ))
                            ) : (
                                <div className="pos-empty-state">Nenhuma empresa encontrada. Cadastre abaixo para reutilizar depois.</div>
                            )}
                        </div>

                        <div className="pos-recipient-form-grid">
                            <label className="pos-discount-form-field">
                                Razao social
                                <input
                                    className="ui-input"
                                    value={quickCompanyForm.name}
                                    onChange={(event) => onQuickCompanyFormChange('name', event.target.value)}
                                    placeholder="Nome da empresa"
                                />
                            </label>

                            <label className="pos-discount-form-field">
                                Nome fantasia
                                <input
                                    className="ui-input"
                                    value={quickCompanyForm.trade_name}
                                    onChange={(event) => onQuickCompanyFormChange('trade_name', event.target.value)}
                                    placeholder="Nome fantasia"
                                />
                            </label>

                            <label className="pos-discount-form-field">
                                CNPJ
                                <input
                                    className="ui-input"
                                    value={quickCompanyForm.document}
                                    onChange={(event) => onQuickCompanyFormChange('document', event.target.value)}
                                    placeholder="Somente numeros"
                                />
                            </label>

                            <label className="pos-discount-form-field">
                                Inscrição estadual
                                <input
                                    className="ui-input"
                                    value={quickCompanyForm.state_registration}
                                    onChange={(event) => onQuickCompanyFormChange('state_registration', event.target.value)}
                                    placeholder="Opcional"
                                />
                            </label>

                            <label className="pos-discount-form-field span-2">
                                E-mail
                                <input
                                    className="ui-input"
                                    type="email"
                                    value={quickCompanyForm.email}
                                    onChange={(event) => onQuickCompanyFormChange('email', event.target.value)}
                                    placeholder="Opcional"
                                />
                            </label>

                            <label className="pos-discount-form-field span-2">
                                Telefone
                                <input
                                    className="ui-input"
                                    value={quickCompanyForm.phone}
                                    onChange={(event) => onQuickCompanyFormChange('phone', event.target.value)}
                                    placeholder="Opcional"
                                />
                            </label>

                            {documentModel === '55' ? (
                                <>
                                    <label className="pos-discount-form-field span-2">
                                        Logradouro
                                        <input
                                            className="ui-input"
                                            value={quickCompanyForm.street}
                                            onChange={(event) => onQuickCompanyFormChange('street', event.target.value)}
                                            placeholder="Rua, avenida, estrada"
                                        />
                                    </label>

                                    <label className="pos-discount-form-field">
                                        Numero
                                        <input
                                            className="ui-input"
                                            value={quickCompanyForm.number}
                                            onChange={(event) => onQuickCompanyFormChange('number', event.target.value)}
                                            placeholder="Numero"
                                        />
                                    </label>

                                    <label className="pos-discount-form-field">
                                        Complemento
                                        <input
                                            className="ui-input"
                                            value={quickCompanyForm.complement}
                                            onChange={(event) => onQuickCompanyFormChange('complement', event.target.value)}
                                            placeholder="Opcional"
                                        />
                                    </label>

                                    <label className="pos-discount-form-field">
                                        Bairro
                                        <input
                                            className="ui-input"
                                            value={quickCompanyForm.district}
                                            onChange={(event) => onQuickCompanyFormChange('district', event.target.value)}
                                            placeholder="Bairro"
                                        />
                                    </label>

                                    <label className="pos-discount-form-field">
                                        Municipio
                                        <input
                                            className="ui-input"
                                            value={quickCompanyForm.city_name}
                                            onChange={(event) => onQuickCompanyFormChange('city_name', event.target.value)}
                                            placeholder="Cidade"
                                        />
                                    </label>

                                    <label className="pos-discount-form-field">
                                        Código IBGE
                                        <input
                                            className="ui-input"
                                            value={quickCompanyForm.city_code}
                                            onChange={(event) => onQuickCompanyFormChange('city_code', event.target.value)}
                                            placeholder="7 digitos"
                                        />
                                    </label>

                                    <label className="pos-discount-form-field">
                                        UF
                                        <input
                                            className="ui-input"
                                            value={quickCompanyForm.state}
                                            onChange={(event) => onQuickCompanyFormChange('state', event.target.value)}
                                            placeholder="UF"
                                        />
                                    </label>

                                    <label className="pos-discount-form-field">
                                        CEP
                                        <input
                                            className="ui-input"
                                            value={quickCompanyForm.zip_code}
                                            onChange={(event) => onQuickCompanyFormChange('zip_code', event.target.value)}
                                            placeholder="Somente numeros"
                                        />
                                    </label>
                                </>
                            ) : null}
                        </div>

                        <div className="pos-quick-customer-actions">
                            <button className="ui-button-ghost" type="button" onClick={onQuickCompanyCreate} disabled={creatingCompany}>
                                <i className="fa-solid fa-building-circle-check" />
                                {creatingCompany ? 'Salvando empresa...' : 'Cadastrar empresa'}
                            </button>
                        </div>
                    </div>
                ) : null}

                <div className="pos-quick-customer-actions">
                    <button className="ui-button-ghost" type="button" onClick={onClose}>
                        Voltar
                    </button>
                    <button className="pos-finalize-button" type="submit" disabled={submitting}>
                        <i className="fa-solid fa-check" />
                        {submitting ? 'Concluindo...' : documentModel === '55' ? 'Emitir NF-e / DANFE' : 'Emitir cupom'}
                    </button>
                </div>
            </form>
        </div>
    )
}
