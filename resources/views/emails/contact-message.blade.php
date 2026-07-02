<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Novo contato pelo site Nimvo</title>
</head>
<body style="margin:0; padding:32px; background:#f1f5f9; font-family: Arial, Helvetica, sans-serif; color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; border:1px solid rgba(15,23,42,0.08);">
        <tr>
            <td style="background:#0a1628; padding:20px 28px;">
                <span style="color:#ffffff; font-size:18px; font-weight:700;">Nimvo</span>
                <span style="color:#94a3b8; font-size:13px; display:block; margin-top:2px;">Novo contato recebido pelo site</span>
            </td>
        </tr>
        <tr>
            <td style="padding:28px;">
                <p style="margin:0 0 14px; font-size:14px;"><strong>Nome:</strong> {{ $senderName }}</p>
                <p style="margin:0 0 14px; font-size:14px;"><strong>E-mail:</strong> {{ $senderEmail }}</p>
                @if ($senderPhone)
                    <p style="margin:0 0 14px; font-size:14px;"><strong>Telefone:</strong> {{ $senderPhone }}</p>
                @endif
                <p style="margin:18px 0 6px; font-size:13px; color:#475569; text-transform:uppercase; letter-spacing:0.05em; font-weight:700;">Mensagem</p>
                <p style="margin:0; font-size:14px; line-height:1.6; white-space:pre-line;">{{ $body }}</p>
            </td>
        </tr>
    </table>
</body>
</html>
