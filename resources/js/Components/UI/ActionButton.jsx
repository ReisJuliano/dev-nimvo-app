export default function ActionButton({
    children,
    icon = null,
    tone = 'primary',
    href = null,
    type = 'button',
    className = '',
    iconOnly = false,
    ...props
}) {
    const classes = ['action-button', `tone-${tone}`, iconOnly ? 'icon-only' : '', className]
        .filter(Boolean)
        .join(' ')

    const content = (
        <>
            {icon ? <i className={`fa-solid ${icon}`} /> : null}
            {iconOnly ? null : <span>{children}</span>}
        </>
    )

    if (href) {
        return (
            <a className={classes} href={href} {...props}>
                {content}
            </a>
        )
    }

    return (
        <button className={classes} type={type} {...props}>
            {content}
        </button>
    )
}
