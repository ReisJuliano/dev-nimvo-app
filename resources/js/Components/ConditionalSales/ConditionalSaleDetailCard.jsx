import { Avatar, Button, Card, Chip, Input, Table } from '@heroui/react'
import { AlertTriangle, Check, CreditCard, PackageSearch, RotateCcw, ShoppingBag } from 'lucide-react'
import { formatDate, formatDateTime, formatMoney, formatNumber } from '@/lib/format'

function initials(name) {
    return String(name || 'C')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || 'C'
}

function FieldError({ message }) {
    if (!message) {
        return null
    }

    return <span className="text-xs font-medium text-danger">{message}</span>
}

function InfoTile({ label, value }) {
    return (
        <div className="rounded-2xl bg-slate-50 p-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground-500">{label}</span>
            <strong className="mt-1 block text-sm text-foreground">{value}</strong>
        </div>
    )
}

function StatusChip({ label, color }) {
    return (
        <Chip color={color} size="sm" variant="flat">
            {label}
        </Chip>
    )
}

export default function ConditionalSaleDetailCard({
    conditionalSale,
    returnForm,
    finalizeForm,
    finalizePreview,
    paymentMethods,
    hasCashPayment,
    onReturnSubmit,
    onFinalizeSubmit,
    onReturnItemChange,
    onFinalizeItemChange,
    onReturnAll,
    onFinalizePreset,
    onAddPayment,
    onRemovePayment,
    onPaymentChange,
}) {
    if (!conditionalSale) {
        return (
            <Card className="col-span-12 bg-content1 rounded-large shadow-small xl:col-span-8">
                <Card.Content className="flex min-h-96 flex-col items-center justify-center gap-3 p-4 text-foreground-400">
                    <PackageSearch size={30} strokeWidth={2} />
                    <span className="text-sm font-semibold uppercase tracking-[0.18em]">Sem selecao</span>
                </Card.Content>
            </Card>
        )
    }

    const unresolvedItems = conditionalSale.items.filter((item) => Number(item.remaining_quantity) > 0)

    return (
        <Card className="col-span-12 bg-content1 rounded-large shadow-small xl:col-span-8">
            <Card.Header className="flex flex-col gap-4 p-4 pb-0 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-center gap-3">
                    <Avatar size="md" variant="flat">
                        <Avatar.Fallback>{initials(conditionalSale.customer.name)}</Avatar.Fallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <strong className="text-base text-foreground">{conditionalSale.code}</strong>
                        <span className="text-sm text-foreground-500">{conditionalSale.customer.name}</span>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <StatusChip color={conditionalSale.status_tone} label={conditionalSale.status_label} />
                    {conditionalSale.sale ? (
                        <Chip color="success" size="sm" variant="flat">
                            {conditionalSale.sale.sale_number}
                        </Chip>
                    ) : null}
                </div>
            </Card.Header>

            <Card.Content className="space-y-4 p-4">
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                    <InfoTile label="Retirada" value={formatDateTime(conditionalSale.withdrawn_at)} />
                    <InfoTile label="Prazo" value={formatDate(conditionalSale.due_at)} />
                    <InfoTile label="Aberto" value={formatMoney(conditionalSale.outstanding_total)} />
                    <InfoTile label="Contato" value={conditionalSale.customer.phone || '-'} />
                </div>

                <Card className="rounded-large border border-slate-200 bg-slate-50 shadow-none">
                    <Card.Header className="p-4 pb-0">
                        <strong className="text-sm text-foreground">Itens</strong>
                    </Card.Header>
                    <Card.Content className="p-4">
                        <Table variant="secondary">
                            <Table.ScrollContainer>
                                <Table.Content aria-label="Itens da condicional">
                                    <Table.Header>
                                        <Table.Column>SKU</Table.Column>
                                        <Table.Column>Item</Table.Column>
                                        <Table.Column>Saida</Table.Column>
                                        <Table.Column>Volta</Table.Column>
                                        <Table.Column>Aberto</Table.Column>
                                    </Table.Header>
                                    <Table.Body>
                                        {conditionalSale.items.map((item) => (
                                            <Table.Row key={item.id}>
                                                <Table.Cell>{item.product_code}</Table.Cell>
                                                <Table.Cell>{item.product_name}</Table.Cell>
                                                <Table.Cell>{formatNumber(item.quantity_sent)}</Table.Cell>
                                                <Table.Cell>{formatNumber(item.quantity_returned)}</Table.Cell>
                                                <Table.Cell>{formatNumber(item.remaining_quantity)}</Table.Cell>
                                            </Table.Row>
                                        ))}
                                    </Table.Body>
                                </Table.Content>
                            </Table.ScrollContainer>
                        </Table>
                    </Card.Content>
                </Card>

                {conditionalSale.status === 'closed' ? (
                    <Card className="rounded-large border border-slate-200 bg-slate-50 shadow-none">
                        <Card.Content className="grid gap-3 p-4 md:grid-cols-3">
                            <InfoTile label="Subtotal" value={formatMoney(conditionalSale.subtotal)} />
                            <InfoTile label="Cobrado" value={formatMoney(conditionalSale.billed_total)} />
                            <InfoTile label="Devolvido" value={formatMoney(conditionalSale.returned_total)} />
                        </Card.Content>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        <Card className="rounded-large border border-slate-200 bg-slate-50 shadow-none">
                            <Card.Header className="flex items-center justify-between p-4 pb-0">
                                <div className="flex items-center gap-2">
                                    <RotateCcw size={18} strokeWidth={2.2} />
                                    <strong className="text-sm text-foreground">Devolucao</strong>
                                </div>
                                <Chip color="warning" size="sm" variant="flat">
                                    Parcial
                                </Chip>
                            </Card.Header>
                            <Card.Content className="space-y-4 p-4">
                                <form className="space-y-4" onSubmit={onReturnSubmit}>
                                    <Input
                                        type="datetime-local"
                                        value={returnForm.data.returned_at}
                                        onChange={(event) => returnForm.setData('returned_at', event.target.value)}
                                    />
                                    <FieldError message={returnForm.errors.returned_at} />

                                    <div className="space-y-3">
                                        {unresolvedItems.length ? unresolvedItems.map((item) => {
                                            const formItem = returnForm.data.items.find((entry) => Number(entry.id) === Number(item.id))

                                            return (
                                                <div key={`return-${item.id}`} className="space-y-2 rounded-3xl border border-slate-200 bg-white p-3">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="flex flex-col">
                                                            <strong className="text-sm text-foreground">{item.product_name}</strong>
                                                            <span className="text-xs text-foreground-500">Aberto {formatNumber(item.remaining_quantity)}</span>
                                                        </div>
                                                        <Button
                                                            isIconOnly
                                                            aria-label="Devolver tudo"
                                                            type="button"
                                                            variant="flat"
                                                            onPress={() => onReturnAll(item.id, item.remaining_quantity)}
                                                        >
                                                            <Check size={16} strokeWidth={2.2} />
                                                        </Button>
                                                    </div>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        step="0.001"
                                                        value={formItem?.returned_quantity || ''}
                                                        onChange={(event) => onReturnItemChange(item.id, event.target.value)}
                                                    />
                                                </div>
                                            )
                                        }) : (
                                            <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-foreground-400">
                                                <RotateCcw size={24} strokeWidth={2} />
                                                <span className="text-sm font-semibold uppercase tracking-[0.18em]">Sem saldo</span>
                                            </div>
                                        )}
                                    </div>

                                    <FieldError message={returnForm.errors.items} />
                                    <Button color="warning" fullWidth isLoading={returnForm.processing} type="submit">
                                        Registrar devolucao
                                    </Button>
                                </form>
                            </Card.Content>
                        </Card>

                        <Card className="rounded-large border border-slate-200 bg-slate-50 shadow-none">
                            <Card.Header className="flex items-center justify-between p-4 pb-0">
                                <div className="flex items-center gap-2">
                                    <ShoppingBag size={18} strokeWidth={2.2} />
                                    <strong className="text-sm text-foreground">Fechamento</strong>
                                </div>
                                <Chip color={finalizePreview > 0 ? 'success' : 'warning'} size="sm" variant="flat">
                                    {formatMoney(finalizePreview)}
                                </Chip>
                            </Card.Header>
                            <Card.Content className="space-y-4 p-4">
                                <form className="space-y-4" onSubmit={onFinalizeSubmit}>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Input
                                            type="datetime-local"
                                            value={finalizeForm.data.resolved_at}
                                            onChange={(event) => finalizeForm.setData('resolved_at', event.target.value)}
                                        />
                                        <Input
                                            value={conditionalSale.customer.document || '-'}
                                            isReadOnly
                                        />
                                    </div>
                                    <FieldError message={finalizeForm.errors.resolved_at} />

                                    <div className="space-y-3">
                                        {unresolvedItems.map((item) => {
                                            const formItem = finalizeForm.data.items.find((entry) => Number(entry.id) === Number(item.id))

                                            return (
                                                <div key={`finalize-${item.id}`} className="space-y-3 rounded-3xl border border-slate-200 bg-white p-3">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="flex flex-col">
                                                            <strong className="text-sm text-foreground">{item.product_name}</strong>
                                                            <span className="text-xs text-foreground-500">Aberto {formatNumber(item.remaining_quantity)}</span>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            <Button size="sm" type="button" variant="flat" onPress={() => onFinalizePreset(item.id, 'returned_quantity', item.remaining_quantity)}>
                                                                Volta
                                                            </Button>
                                                            <Button size="sm" type="button" variant="flat" onPress={() => onFinalizePreset(item.id, 'kept_quantity', item.remaining_quantity)}>
                                                                Fica
                                                            </Button>
                                                            <Button size="sm" type="button" variant="flat" onPress={() => onFinalizePreset(item.id, 'lost_quantity', item.remaining_quantity)}>
                                                                Perda
                                                            </Button>
                                                            <Button size="sm" type="button" variant="flat" onPress={() => onFinalizePreset(item.id, 'damaged_quantity', item.remaining_quantity)}>
                                                                Avaria
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-3">
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            step="0.001"
                                                            value={formItem?.returned_quantity || ''}
                                                            onChange={(event) => onFinalizeItemChange(item.id, 'returned_quantity', event.target.value)}
                                                        />
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            step="0.001"
                                                            value={formItem?.kept_quantity || ''}
                                                            onChange={(event) => onFinalizeItemChange(item.id, 'kept_quantity', event.target.value)}
                                                        />
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            step="0.001"
                                                            value={formItem?.lost_quantity || ''}
                                                            onChange={(event) => onFinalizeItemChange(item.id, 'lost_quantity', event.target.value)}
                                                        />
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            step="0.001"
                                                            value={formItem?.damaged_quantity || ''}
                                                            onChange={(event) => onFinalizeItemChange(item.id, 'damaged_quantity', event.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>

                                    <FieldError message={finalizeForm.errors.items} />

                                    {finalizePreview > 0 ? (
                                        <Card className="rounded-large border border-slate-200 bg-white shadow-none">
                                            <Card.Header className="flex items-center justify-between p-4 pb-0">
                                                <div className="flex items-center gap-2">
                                                    <CreditCard size={18} strokeWidth={2.2} />
                                                    <strong className="text-sm text-foreground">Pagamento</strong>
                                                </div>
                                                <Button size="sm" type="button" variant="flat" onPress={onAddPayment}>
                                                    Parcela
                                                </Button>
                                            </Card.Header>
                                            <Card.Content className="space-y-3 p-4">
                                                {finalizeForm.data.payments.map((payment, index) => (
                                                    <div key={`payment-${index}`} className="grid grid-cols-[1fr,1fr,auto] gap-3">
                                                        <select
                                                            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-sky-400"
                                                            value={payment.method}
                                                            onChange={(event) => onPaymentChange(index, 'method', event.target.value)}
                                                        >
                                                            {paymentMethods.map((method) => (
                                                                <option key={method.value} value={method.value}>
                                                                    {method.label}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={payment.amount}
                                                            onChange={(event) => onPaymentChange(index, 'amount', event.target.value)}
                                                        />
                                                        <Button
                                                            isIconOnly
                                                            aria-label="Remover parcela"
                                                            color="danger"
                                                            isDisabled={finalizeForm.data.payments.length === 1}
                                                            type="button"
                                                            variant="flat"
                                                            onPress={() => onRemovePayment(index)}
                                                        >
                                                            <AlertTriangle size={16} strokeWidth={2.2} />
                                                        </Button>
                                                    </div>
                                                ))}

                                                {hasCashPayment ? (
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={finalizeForm.data.cash_received}
                                                        onChange={(event) => finalizeForm.setData('cash_received', event.target.value)}
                                                    />
                                                ) : null}
                                                <FieldError message={finalizeForm.errors.payments} />
                                                <FieldError message={finalizeForm.errors.cash_received} />
                                            </Card.Content>
                                        </Card>
                                    ) : null}

                                    <Input
                                        value={finalizeForm.data.notes}
                                        onChange={(event) => finalizeForm.setData('notes', event.target.value)}
                                        placeholder="Obs"
                                    />

                                    <Button color="success" fullWidth isLoading={finalizeForm.processing} type="submit">
                                        Encerrar condicional
                                    </Button>
                                </form>
                            </Card.Content>
                        </Card>
                    </div>
                )}
            </Card.Content>
        </Card>
    )
}
