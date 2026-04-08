import { useMemo } from 'react'
import useConfirmedSearch from '@/hooks/useConfirmedSearch'
import { hasTextSearchWildcard, matchesTextSearchAny, normalizeTextSearch } from '@/lib/textSearch'
import OrdersModal from './OrdersModal'

export default function OrderTransferModal({ form, setForm, customers, creatingCustomer = false, onCreateCustomer, onClose, onSubmit }) {
    const searchControl = useConfirmedSearch('')
    const normalizedSearch = normalizeTextSearch(searchControl.value)
    const normalizedDraftSearch = normalizeTextSearch(searchControl.draftValue)
    const wildcardSearch = hasTextSearchWildcard(normalizedDraftSearch)
    const exactMatch = normalizedDraftSearch && !wildcardSearch
        ? customers.find((customer) => normalizeTextSearch(customer.name) === normalizedDraftSearch)
        : null
    const visibleCustomers = useMemo(() => {
        if (!normalizedSearch) {
            return []
        }

        const matches = customers.filter((customer) => matchesTextSearchAny([customer.name, customer.phone], normalizedSearch))

        return [...matches].sort((left, right) => {
            const leftSelected = String(left.id) === String(form.customerId)
            const rightSelected = String(right.id) === String(form.customerId)

            if (leftSelected !== rightSelected) {
                return leftSelected ? -1 : 1
            }

            return String(left.name).localeCompare(String(right.name))
        })
    }, [customers, form.customerId, normalizedSearch])

    return (
        <OrdersModal
            title="Cliente"
            size="lg"
            className="orders-modal-edit-terminal"
            bodyClassName="orders-modal-edit-terminal-body"
            onClose={onClose}
        >
            <form className="orders-edit-customer-form" onSubmit={onSubmit}>
                <div className="orders-edit-customer-shell">
                    <div className="orders-edit-customer-main">
                        <div className="orders-edit-customer-toolbar">
                            <label className="orders-edit-customer-search">
                                <i className="fa-solid fa-magnifying-glass" />
                                <input
                                    className="ui-input"
                                    value={searchControl.draftValue}
                                    onChange={(event) => searchControl.setDraftValue(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key !== 'Enter') {
                                            return
                                        }

                                        event.preventDefault()
                                        searchControl.apply()
                                    }}
                                    placeholder="Pesquisar cliente"
                                    aria-label="Pesquisar cliente"
                                />
                                <button type="button" className="orders-edit-customer-search-button" onClick={() => searchControl.apply()}>
                                    <i className="fa-solid fa-magnifying-glass" />
                                    Pesquisar
                                </button>
                            </label>

                            <button
                                type="button"
                                className="orders-edit-customer-quick create"
                                onClick={() => onCreateCustomer?.(searchControl.draftValue)}
                                aria-label="Criar cliente"
                                title="Criar cliente"
                                disabled={!normalizedDraftSearch || wildcardSearch || Boolean(exactMatch) || creatingCustomer}
                            >
                                <i className={`fa-solid ${creatingCustomer ? 'fa-spinner fa-spin' : 'fa-user-plus'}`} />
                            </button>

                            <button
                                type="button"
                                className={`orders-edit-customer-quick ${!form.customerId ? 'active' : ''}`}
                                onClick={() => setForm((current) => ({ ...current, customerId: '' }))}
                                aria-label="Remover cliente"
                                title="Sem cliente"
                            >
                                <i className="fa-solid fa-user-slash" />
                            </button>
                        </div>

                        <div className="orders-edit-customer-grid">
                            {normalizedSearch && visibleCustomers.length ? (
                                visibleCustomers.map((customer) => {
                                    const isActive = String(customer.id) === String(form.customerId)

                                    return (
                                        <button
                                            key={customer.id}
                                            type="button"
                                            className={`orders-edit-customer-card ${isActive ? 'active' : ''}`}
                                            onClick={() => setForm((current) => ({ ...current, customerId: String(customer.id) }))}
                                            aria-label={`Selecionar ${customer.name}`}
                                            title={customer.name}
                                        >
                                            <span className="orders-edit-customer-card-icon">
                                                <i className={`fa-solid ${isActive ? 'fa-circle-check' : 'fa-user'}`} />
                                            </span>

                                            <div className="orders-edit-customer-card-copy">
                                                <strong>{customer.name}</strong>
                                                {customer.phone ? <small>{customer.phone}</small> : null}
                                            </div>

                                            <span className="orders-edit-customer-card-check">
                                                <i className="fa-solid fa-check" />
                                            </span>
                                        </button>
                                    )
                                })
                            ) : normalizedSearch ? (
                                <div className="orders-edit-customer-empty">
                                    <i className="fa-solid fa-user-xmark" />
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <aside className="orders-terminal-sidebar orders-edit-terminal-sidebar">
                        <button
                            type="button"
                            className="orders-edit-terminal-sidebar-icon"
                            onClick={onClose}
                            aria-label="Cancelar edicao"
                            title="Cancelar"
                        >
                            <i className="fa-solid fa-xmark" />
                        </button>

                        <button
                            type="submit"
                            className="orders-edit-terminal-sidebar-icon confirm"
                            aria-label="Salvar alteracoes"
                            title="Salvar"
                        >
                            <i className="fa-solid fa-check" />
                        </button>
                    </aside>
                </div>
            </form>
        </OrdersModal>
    )
}
