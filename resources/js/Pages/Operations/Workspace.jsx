import AppLayout from '@/Layouts/AppLayout'
import { CategoriesWorkspace, CustomersWorkspace, SuppliersWorkspace } from './workspaces/CatalogWorkspaces'
import { DeliveryWorkspace, PurchasesWorkspace } from './workspaces/CommerceWorkspaces'
import { StockAdjustmentsWorkspace, StockInboundWorkspace, StockTransfersWorkspace } from './workspaces/InventoryWorkspaces'
import './operations-workspace.css'

export default function OperationsWorkspace({ moduleKey, moduleTitle, moduleDescription, payload }) {
    return (
        <AppLayout title={moduleTitle}>
            <div className="ops-workspace-page">
                <section className="ops-workspace-hero">
                    <div>
                        <span>Operacoes</span>
                        <h1>{moduleTitle}</h1>
                    </div>
                </section>

                {moduleKey === 'clientes' ? <CustomersWorkspace moduleKey={moduleKey} payload={payload} /> : null}
                {moduleKey === 'fornecedores' ? <SuppliersWorkspace moduleKey={moduleKey} payload={payload} /> : null}
                {moduleKey === 'categorias' ? <CategoriesWorkspace moduleKey={moduleKey} payload={payload} /> : null}
                {moduleKey === 'delivery' ? <DeliveryWorkspace moduleKey={moduleKey} payload={payload} /> : null}
                {moduleKey === 'compras' ? <PurchasesWorkspace moduleKey={moduleKey} payload={payload} /> : null}
                {moduleKey === 'entrada-estoque' ? <StockInboundWorkspace moduleKey={moduleKey} payload={payload} /> : null}
                {moduleKey === 'ajuste-estoque' ? <StockAdjustmentsWorkspace moduleKey={moduleKey} payload={payload} /> : null}
                {moduleKey === 'movimentacao-estoque' ? <StockTransfersWorkspace moduleKey={moduleKey} payload={payload} /> : null}
            </div>
        </AppLayout>
    )
}
