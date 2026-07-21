<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Pacote fiscal mensal</title>
</head>
<body style="margin:0; padding:32px; background:#f1f5f9; font-family: Arial, Helvetica, sans-serif; color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; border:1px solid rgba(15,23,42,0.08);">
        <tr>
            <td style="background:#0a1628; padding:20px 28px;">
                <span style="color:#ffffff; font-size:18px; font-weight:700;">Nimvo</span>
                <span style="color:#94a3b8; font-size:13px; display:block; margin-top:2px;">Pacote fiscal mensal — {{ $storeName }}</span>
            </td>
        </tr>
        <tr>
            <td style="padding:28px;">
                <p style="margin:0 0 14px; font-size:14px;">
                    Segue em anexo o pacote fiscal de <strong>{{ $monthLabel }}</strong> da loja <strong>{{ $storeName }}</strong>.
                </p>
                <p style="margin:0 0 14px; font-size:14px; line-height:1.6;">
                    O zip contém as notas autorizadas, canceladas, inutilizações de numeração e cartas de correção
                    do período, além de um resumo em CSV e um relatório de fechamento em PDF (totais por dia e forma de pagamento).
                </p>
                <p style="margin:18px 0 0; font-size:13px; color:#475569;">
                    Este e-mail foi enviado automaticamente pelo Nimvo.
                </p>
            </td>
        </tr>
    </table>
</body>
</html>
