<?php

namespace App\Support\Tenant;

class AuditActions
{
    public const SALE_CANCELLED = 'venda.cancelada';
    public const FISCAL_DOCUMENT_CANCELLED = 'fiscal.documento_cancelado';
    public const FISCAL_CONTINGENCY_EMITTED = 'fiscal.emitido_em_contingencia';
    public const FISCAL_NUMBERING_VOIDED = 'fiscal.numeracao_inutilizada';
    public const FISCAL_CORRECTION_LETTER_REQUESTED = 'fiscal.carta_correcao_solicitada';
    public const DISCOUNT_AUTHORIZED = 'venda.desconto_autorizado';
    public const SUPERVISOR_AUTHORIZED = 'supervisor.autorizado';
    public const STOCK_MANUAL_ADJUSTMENT = 'estoque.ajuste_manual';
    public const INVENTORY_APPROVED = 'inventario.aprovado';
    public const CASH_REGISTER_OPENED = 'caixa.aberto';
    public const CASH_REGISTER_CLOSED = 'caixa.fechado';
    public const CASH_REGISTER_CLOSED_WITH_DIFFERENCE = 'caixa.fechado_com_quebra';
    public const CASH_REGISTER_MOVEMENT = 'caixa.sangria_suprimento';
    public const CREDIT_RECEIVED = 'fiado.recebido';
    public const CREDIT_REVERSED = 'fiado.estornado';
    public const USER_CREATED = 'usuario.criado';
    public const USER_UPDATED = 'usuario.atualizado';
    public const USER_DEACTIVATED = 'usuario.desativado';
    public const USER_ABILITIES_CHANGED = 'usuario.permissoes_alteradas';
    public const SETTINGS_FISCAL_UPDATED = 'configuracoes.fiscal_alterada';
    public const SETTINGS_CASH_CLOSING_UPDATED = 'configuracoes.fechamento_caixa_alterada';
    public const PRODUCT_PRICE_CHANGED = 'produto.preco_alterado';
    public const PRODUCT_COST_CHANGED = 'produto.custo_alterado';
    public const RECORD_DELETED = 'registro.excluido';
    public const RECORD_CREATED = 'registro.criado';
    public const RECORD_UPDATED = 'registro.atualizado';
    public const STOCK_LOSS_REGISTERED = 'estoque.perda_registrada';
    public const SALE_FINALIZED = 'venda.finalizada';

    public static function labels(): array
    {
        return [
            self::SALE_CANCELLED => 'Venda cancelada',
            self::FISCAL_DOCUMENT_CANCELLED => 'Documento fiscal cancelado',
            self::FISCAL_CONTINGENCY_EMITTED => 'Emissao em contingencia',
            self::FISCAL_NUMBERING_VOIDED => 'Inutilizacao de numeracao',
            self::FISCAL_CORRECTION_LETTER_REQUESTED => 'Carta de correcao solicitada',
            self::DISCOUNT_AUTHORIZED => 'Desconto autorizado',
            self::SUPERVISOR_AUTHORIZED => 'Autorizacao de supervisor',
            self::STOCK_MANUAL_ADJUSTMENT => 'Ajuste manual de estoque',
            self::INVENTORY_APPROVED => 'Inventario aprovado',
            self::CASH_REGISTER_OPENED => 'Abertura de caixa',
            self::CASH_REGISTER_CLOSED => 'Fechamento de caixa',
            self::CASH_REGISTER_CLOSED_WITH_DIFFERENCE => 'Fechamento de caixa com quebra',
            self::CASH_REGISTER_MOVEMENT => 'Sangria/suprimento',
            self::CREDIT_RECEIVED => 'Recebimento de fiado',
            self::CREDIT_REVERSED => 'Estorno de fiado',
            self::USER_CREATED => 'Usuario criado',
            self::USER_UPDATED => 'Usuario atualizado',
            self::USER_DEACTIVATED => 'Usuario desativado',
            self::USER_ABILITIES_CHANGED => 'Permissoes de usuario alteradas',
            self::SETTINGS_FISCAL_UPDATED => 'Configuracoes fiscais alteradas',
            self::SETTINGS_CASH_CLOSING_UPDATED => 'Configuracoes de fechamento de caixa alteradas',
            self::PRODUCT_PRICE_CHANGED => 'Preco de produto alterado',
            self::PRODUCT_COST_CHANGED => 'Custo de produto alterado',
            self::RECORD_DELETED => 'Registro excluido',
            self::RECORD_CREATED => 'Registro criado',
            self::RECORD_UPDATED => 'Registro atualizado',
            self::STOCK_LOSS_REGISTERED => 'Perda de estoque registrada',
            self::SALE_FINALIZED => 'Venda finalizada',
        ];
    }

    public static function label(string $action): string
    {
        return self::labels()[$action] ?? $action;
    }
}
