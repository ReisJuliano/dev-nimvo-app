import { Button, Card, Chip, Table } from '@heroui/react'
import { ArrowRightLeft, Eye } from 'lucide-react'
import { formatDate, formatMoney } from '@/lib/format'

function StatusChip({ label, color }) {
    return (
        <Chip color={color} size="sm" variant="flat">
            {label}
        </Chip>
    )
}

export default function ConditionalSalesTableCard({
    conditionals,
    selectedConditionalId,
    statusOptions,
    filters,
    onStatusChange,
    onSelect,
}) {
    return (
        <Card className="col-span-12 bg-content1 rounded-large shadow-small xl:col-span-8">
            <Card.Header className="flex flex-col gap-3 p-4 pb-0 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                        <ArrowRightLeft size={20} strokeWidth={2.2} />
                    </div>
                    <div className="flex flex-col">
                        <strong className="text-base text-foreground">Condicionais</strong>
                        <span className="text-sm text-foreground-500">{conditionals.length} registro(s)</span>
                    </div>
                </div>

                <label className="flex min-w-48 flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground-500">Filtro</span>
                    <select
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-sky-400"
                        value={filters.status}
                        onChange={(event) => onStatusChange(event.target.value)}
                    >
                        {statusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>
            </Card.Header>
            <Card.Content className="p-4">
                {conditionals.length ? (
                    <Table variant="secondary">
                        <Table.ScrollContainer>
                            <Table.Content aria-label="Lista de condicionais">
                                <Table.Header>
                                    <Table.Column>Code</Table.Column>
                                    <Table.Column>Cliente</Table.Column>
                                    <Table.Column>Prazo</Table.Column>
                                    <Table.Column>Valor</Table.Column>
                                    <Table.Column>Status</Table.Column>
                                    <Table.Column>Acoes</Table.Column>
                                </Table.Header>
                                <Table.Body>
                                    {conditionals.map((conditionalSale) => (
                                        <Table.Row
                                            key={conditionalSale.id}
                                            className={selectedConditionalId === conditionalSale.id ? 'bg-sky-50' : ''}
                                        >
                                            <Table.Cell>{conditionalSale.code}</Table.Cell>
                                            <Table.Cell>{conditionalSale.customer.name}</Table.Cell>
                                            <Table.Cell>{formatDate(conditionalSale.due_at)}</Table.Cell>
                                            <Table.Cell>{formatMoney(conditionalSale.outstanding_total)}</Table.Cell>
                                            <Table.Cell>
                                                <StatusChip color={conditionalSale.status_tone} label={conditionalSale.status_label} />
                                            </Table.Cell>
                                            <Table.Cell>
                                                <Button
                                                    isIconOnly
                                                    aria-label="Abrir condicional"
                                                    variant="flat"
                                                    onPress={() => onSelect(conditionalSale.id)}
                                                >
                                                    <Eye size={16} strokeWidth={2.2} />
                                                </Button>
                                            </Table.Cell>
                                        </Table.Row>
                                    ))}
                                </Table.Body>
                            </Table.Content>
                        </Table.ScrollContainer>
                    </Table>
                ) : (
                    <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-foreground-400">
                        <ArrowRightLeft size={28} strokeWidth={2} />
                        <span className="text-sm font-semibold uppercase tracking-[0.18em]">Sem registros</span>
                    </div>
                )}
            </Card.Content>
        </Card>
    )
}
