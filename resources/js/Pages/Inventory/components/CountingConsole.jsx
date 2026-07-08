import { useEffect, useRef, useState } from 'react'
import { apiRequest } from '@/lib/http'
import { formatNumber, formatTime } from '@/lib/format'

function playBeep(success) {
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext
        if (!AudioContextClass) return

        const ctx = new AudioContextClass()
        const oscillator = ctx.createOscillator()
        const gain = ctx.createGain()

        oscillator.type = 'sine'
        oscillator.frequency.value = success ? 880 : 220
        gain.gain.setValueAtTime(0.08, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18)

        oscillator.connect(gain)
        gain.connect(ctx.destination)
        oscillator.start()
        oscillator.stop(ctx.currentTime + 0.18)
        oscillator.onended = () => ctx.close()
    } catch {
        // ambiente sem suporte a Web Audio — segue sem som
    }
}

export default function CountingConsole({ sessionId, blind, onScanned, onError }) {
    const [barcode, setBarcode] = useState('')
    const [quantity, setQuantity] = useState('1')
    const [submitting, setSubmitting] = useState(false)
    const [feed, setFeed] = useState([])
    const inputRef = useRef(null)

    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    async function handleSubmit(event) {
        event.preventDefault()

        const code = barcode.trim()
        if (!code || submitting) return

        setSubmitting(true)

        try {
            const response = await apiRequest(`/api/inventory/sessions/${sessionId}/counts`, {
                method: 'post',
                data: { barcode: code, quantity: Number(quantity || 1), source: 'scanner' },
            })

            playBeep(true)
            setFeed((current) => [
                { id: `${response.item.id}-${Date.now()}`, ...response.item, at: new Date() },
                ...current,
            ].slice(0, 8))
            setBarcode('')
            setQuantity('1')
            onScanned?.(response.item)
        } catch (error) {
            playBeep(false)
            onError?.(error.message)
        } finally {
            setSubmitting(false)
            inputRef.current?.focus()
        }
    }

    return (
        <div className="ivs-console">
            <form className="ivs-console-scan" onSubmit={handleSubmit}>
                <label className="ivs-console-field ivs-console-field--barcode">
                    <span>Bipe o código de barras</span>
                    <input
                        ref={inputRef}
                        className="ui-input ivs-console-input"
                        autoFocus
                        autoComplete="off"
                        value={barcode}
                        onChange={(event) => setBarcode(event.target.value)}
                        placeholder="Aponte o leitor aqui..."
                    />
                </label>

                <label className="ivs-console-field ivs-console-field--qty">
                    <span>Quantidade</span>
                    <div className="ivs-console-stepper">
                        <button type="button" onClick={() => setQuantity((q) => String(Math.max(0.001, Number(q || 1) - 1)))}>
                            <i className="fa-solid fa-minus" />
                        </button>
                        <input
                            className="ui-input"
                            type="number"
                            step="0.001"
                            min="0.001"
                            value={quantity}
                            onChange={(event) => setQuantity(event.target.value)}
                        />
                        <button type="button" onClick={() => setQuantity((q) => String(Number(q || 0) + 1))}>
                            <i className="fa-solid fa-plus" />
                        </button>
                    </div>
                </label>

                <button type="submit" className="ui-button ivs-console-submit" disabled={submitting}>
                    <i className="fa-solid fa-barcode" />
                    {submitting ? 'Registrando...' : 'Registrar contagem'}
                </button>
            </form>

            {blind ? (
                <div className="ui-alert info ivs-blind-notice">
                    <i className="fa-solid fa-eye-slash" />
                    <p>Contagem cega — a quantidade do sistema fica oculta até a contagem ser encerrada.</p>
                </div>
            ) : null}

            <div className="ivs-console-feed">
                <p className="nimvo-section-label">Últimos itens bipados</p>
                {feed.length ? (
                    <ul>
                        {feed.map((entry) => (
                            <li key={entry.id} className="ivs-console-feed-row">
                                <div>
                                    <strong>{entry.product_name}</strong>
                                    <small>{entry.product_code || entry.product_barcode || '-'}</small>
                                </div>
                                <div className="ivs-console-feed-meta">
                                    <span>{formatNumber(entry.counted_quantity, { maximumFractionDigits: 3 })} un.</span>
                                    <small>{formatTime(entry.at)}</small>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="ivs-console-feed-empty">Nenhum item bipado ainda nesta tela.</p>
                )}
            </div>
        </div>
    )
}
