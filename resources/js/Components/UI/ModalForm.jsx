import CompactModal from './CompactModal'

export default function ModalForm({
    open,
    title,
    description = null,
    icon = 'fa-pen-to-square',
    size = 'md',
    children,
    footer = null,
    onClose,
}) {
    if (!open) {
        return null
    }

    return (
        <CompactModal
            open={open}
            title={title}
            description={description}
            icon={icon}
            size={size}
            footer={footer}
            onClose={onClose}
        >
            {children}
        </CompactModal>
    )
}
