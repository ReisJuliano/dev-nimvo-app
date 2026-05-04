import { Avatar, Button, Card, Input } from '@heroui/react'
import { Bell, Search, Sparkles } from 'lucide-react'

function initials(name) {
    return String(name || 'U')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || 'U'
}

export default function Toolbar({ authUser, filterForm, onSubmit, onReset }) {
    return (
        <Card className="col-span-12 overflow-hidden rounded-large border border-white/70 bg-gradient-to-r from-sky-100 via-white to-amber-50 shadow-small">
            <Card.Content className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-sky-800">
                        <Sparkles size={16} strokeWidth={2.4} />
                        <span>Venda condicional</span>
                    </div>
                    <form className="flex flex-col gap-3 sm:flex-row" onSubmit={onSubmit}>
                        <Input
                            aria-label="Buscar condicional"
                            className="w-full sm:w-80"
                            placeholder="Buscar cliente ou codigo"
                            startContent={<Search size={16} strokeWidth={2.2} />}
                            value={filterForm.data.search}
                            onChange={(event) => filterForm.setData('search', event.target.value)}
                        />
                        <Button color="primary" type="submit">
                            Buscar
                        </Button>
                        <Button type="button" variant="flat" onClick={onReset}>
                            Limpar
                        </Button>
                    </form>
                </div>

                <div className="flex items-center justify-between gap-3 lg:justify-end">
                    <Button isIconOnly variant="flat" aria-label="Notificacoes">
                        <Bell size={18} strokeWidth={2.2} />
                    </Button>
                    <div className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/80 px-3 py-2">
                        <Avatar size="sm" variant="flat">
                            <Avatar.Fallback>{initials(authUser?.name)}</Avatar.Fallback>
                        </Avatar>
                        <div className="flex flex-col">
                            <strong className="text-sm leading-none text-foreground">{authUser?.name || 'Usuario'}</strong>
                            <span className="text-xs uppercase tracking-[0.18em] text-foreground-500">{authUser?.role || 'operador'}</span>
                        </div>
                    </div>
                </div>
            </Card.Content>
        </Card>
    )
}
