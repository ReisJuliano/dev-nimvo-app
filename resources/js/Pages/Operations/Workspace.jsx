import AppLayout from '@/Layouts/AppLayout'
import { ProducersWorkspace } from './workspaces/PeopleWorkspaces'
import { DeliveryWorkspace, PurchasesWorkspace, ServiceOrdersWorkspace, WeighingWorkspace } from './workspaces/CommerceWorkspaces'
import { KitchenWorkspace, LossesWorkspace, ProductionWorkspace, RecipesWorkspace } from './workspaces/ProductionWorkspaces'
import './operations-workspace.css'

export default function OperationsWorkspace({ moduleKey, moduleTitle, moduleDescription, payload }) {
    return (
        <AppLayout title={moduleTitle}>
            <div className="ops-workspace-page">
                <section className="ops-workspace-hero">
                    <div>
                        <span>Operacoes</span>
                        <h1>{moduleTitle}</h1>
                        <p>{moduleDescription}</p>
                    </div>
                </section>

                {moduleKey === 'produtores' ? <ProducersWorkspace moduleKey={moduleKey} payload={payload} /> : null}
                {moduleKey === 'fichas-tecnicas' ? <RecipesWorkspace moduleKey={moduleKey} payload={payload} /> : null}
                {moduleKey === 'producao' ? <ProductionWorkspace moduleKey={moduleKey} payload={payload} /> : null}
                {moduleKey === 'cozinha' ? <KitchenWorkspace moduleKey={moduleKey} payload={payload} /> : null}
                {moduleKey === 'perdas' ? <LossesWorkspace moduleKey={moduleKey} payload={payload} /> : null}
                {moduleKey === 'pesagem' ? <WeighingWorkspace moduleKey={moduleKey} payload={payload} /> : null}
                {moduleKey === 'delivery' ? <DeliveryWorkspace moduleKey={moduleKey} payload={payload} /> : null}
                {moduleKey === 'compras' ? <PurchasesWorkspace moduleKey={moduleKey} payload={payload} /> : null}
                {moduleKey === 'ordens-servico' ? <ServiceOrdersWorkspace moduleKey={moduleKey} payload={payload} /> : null}
            </div>
        </AppLayout>
    )
}
