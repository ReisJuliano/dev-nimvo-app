<?php

namespace App\Http\Middleware\Central;

use App\Models\Central\LocalAgent;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateLocalAgent
{
    public function handle(Request $request, Closure $next): Response
    {
        $agentKey = trim((string) $request->header('X-Agent-Key'));
        $secret = (string) $request->header('X-Agent-Secret');

        if ($agentKey === '' || $secret === '') {
            abort(401, 'Cabecalhos do agente local nao informados.');
        }

        $agent = LocalAgent::query()
            ->where('agent_key', $agentKey)
            ->where('active', true)
            ->first();

        if (!$agent || !Hash::check($secret, $agent->secret_hash)) {
            abort(401, 'Credenciais do agente local invalidas.');
        }

        $agent->forceFill([
            'last_seen_at' => now(),
            'last_ip' => $request->ip(),
        ])->save();

        $request->attributes->set('localAgent', $agent);

        return $next($request);
    }
}
