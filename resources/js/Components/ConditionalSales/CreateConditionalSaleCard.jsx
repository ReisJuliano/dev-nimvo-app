import { Button, Card, Chip, Input, TextArea } from '@heroui/react'
import { Plus, Trash2 } from 'lucide-react'
import { formatMoney, formatNumber } from '@/lib/format'

function CustomerHint({ customer }) {
    if (!customer) {
        return null
    }

    return (
        <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-slate-50 p-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground-500">Limite</span>
                <strong className="mt-1 block text-sm text-foreground">{formatMoney(customer.credit_limit)}</strong>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground-500">Livre</span>
                <strong className="mt-1 block text-sm text-foreground">{formatMoney(customer.available_limit)}</strong>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground-500">Doc</span>
                <strong className="mt-1 block text-sm text-foreground">{customer.document || '-'}</strong>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground-500">Atrasos</span>
                <strong className="mt-1 block text-sm text-foreground">{customer.overdue_count || 0}</strong>
            </div>
        </div>
    )
}

function ItemRow({ item, index, products, onChange, onRemove, disableRemove }) {
    const product = products.find((entry) => String(entry.id) === String(item.product_id))

    return (
        <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground-500">Produto {index + 1}</span>
                    <div className="flex flex-wrap gap-2">
                        <Chip color="warning" size="sm" variant="flat">
                            Estoque {formatNumber(product?.stock_quantity || 0)}
                        </Chip>
                        <Chip color="success" size="sm" variant="flat">
                            Cond. {formatNumber(product?.conditional_quantity || 0)}
                        </Chip>
                    </div>
                </div>
                <Button
                    isIconOnly
                    aria-label="Remover item"
                    color="danger"
                    isDisabled={disableRemove}
                    type="button"
                    variant="flat"
                    onPress={onRemove}
                >
                    <Trash2 size={16} strokeWidth={2.2} />
                </Button>
            </div>

            <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground-500">SKU</span>
                <select
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-sky-400"
                    value={item.product_id}
                    onChange={(event) => onChange(index, 'product_id', event.target.value)}
                >
                    <option value="">Selecione</option>
                    {products.map((productOption) => (
                        <option key={productOption.id} value={productOption.id}>
                            {productOption.code} · {productOption.name}
                        </option>
                    ))}
                </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground-500">Qtd</span>
                    <Input
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(event) => onChange(index, 'quantity', event.target.value)}
                    />
                </label>
                <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground-500">Valor</span>
                    <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(event) => onChange(index, 'unit_price', event.target.value)}
                    />
                </label>
            </div>
        </div>
    )
}

function ErrorLine({ message }) {
    if (!message) {
        return null
    }

    return <span className="text-xs font-medium text-danger">{message}</span>
}

export default function CreateConditionalSaleCard({
    form,
    customers,
    products,
    selectedCustomer,
    totalPreview,
    onSubmit,
    onAddItem,
    onRemoveItem,
    onItemChange,
}) {
    return (
        <Card className="col-span-12 bg-content1 rounded-large shadow-small xl:col-span-4">
            <Card.Header className="flex items-center justify-between p-4 pb-0">
                <div className="flex flex-col">
                    <strong className="text-base text-foreground">Nova retirada</strong>
                    <span className="text-sm text-foreground-500">{formatMoney(totalPreview)}</span>
                </div>
                <Chip color="warning" size="sm" variant="flat">
                    Abertura
                </Chip>
            </Card.Header>
            <Card.Content className="space-y-4 p-4">
                <form className="space-y-4" onSubmit={onSubmit}>
                    <label className="flex flex-col gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground-500">Cliente</span>
                        <select
                            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-sky-400"
                            value={form.data.customer_id}
                            onChange={(event) => form.setData('customer_id', event.target.value)}
                        >
                            <option value="">Selecione</option>
                            {customers.map((customer) => (
                                <option key={customer.id} value={customer.id}>
                                    {customer.name}
                                </option>
                            ))}
                        </select>
                        <ErrorLine message={form.errors.customer_id} />
                    </label>

                    <CustomerHint customer={selectedCustomer} />

                    <div className="grid grid-cols-2 gap-3">
                        <label className="flex flex-col gap-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground-500">Retirada</span>
                            <Input
                                type="datetime-local"
                                value={form.data.withdrawn_at}
                                onChange={(event) => form.setData('withdrawn_at', event.target.value)}
                            />
                            <ErrorLine message={form.errors.withdrawn_at} />
                        </label>
                        <label className="flex flex-col gap-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground-500">Prazo</span>
                            <Input
                                type="date"
                                value={form.data.due_at}
                                onChange={(event) => form.setData('due_at', event.target.value)}
                            />
                            <ErrorLine message={form.errors.due_at} />
                        </label>
                    </div>

                    <label className="flex flex-col gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground-500">Obs</span>
                        <TextArea
                            minRows={3}
                            value={form.data.notes}
                            onChange={(event) => form.setData('notes', event.target.value)}
                        />
                        <ErrorLine message={form.errors.notes} />
                    </label>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <strong className="text-sm text-foreground">Itens</strong>
                            <Button type="button" variant="flat" onPress={onAddItem}>
                                <Plus size={16} strokeWidth={2.2} />
                                <span>Item</span>
                            </Button>
                        </div>

                        {form.data.items.map((item, index) => (
                            <ItemRow
                                key={`create-item-${index}`}
                                disableRemove={form.data.items.length === 1}
                                index={index}
                                item={item}
                                products={products}
                                onChange={onItemChange}
                                onRemove={() => onRemoveItem(index)}
                            />
                        ))}

                        <ErrorLine message={form.errors.items} />
                    </div>

                    <Button color="primary" fullWidth isLoading={form.processing} type="submit">
                        Criar condicional
                    </Button>
                </form>
            </Card.Content>
        </Card>
    )
}
