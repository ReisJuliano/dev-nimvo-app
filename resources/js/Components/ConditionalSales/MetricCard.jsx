import { Card, Chip } from '@heroui/react'

export default function MetricCard({ icon: Icon, title, value, chipLabel, chipColor = 'warning' }) {
    return (
        <Card className="bg-content1 rounded-large shadow-small">
            <Card.Header className="flex items-center justify-between p-4 pb-0">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                    <Icon size={20} strokeWidth={2.2} />
                </div>
                <Chip color={chipColor} size="sm" variant="flat">
                    {chipLabel}
                </Chip>
            </Card.Header>
            <Card.Content className="space-y-2 p-4 pt-3">
                <span className="text-sm font-medium text-foreground-500">{title}</span>
                <strong className="block text-3xl font-semibold tracking-tight text-foreground">{value}</strong>
            </Card.Content>
        </Card>
    )
}
