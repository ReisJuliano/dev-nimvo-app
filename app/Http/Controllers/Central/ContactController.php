<?php

namespace App\Http\Controllers\Central;

use App\Http\Controllers\Controller;
use App\Http\Requests\Central\StoreContactMessageRequest;
use App\Mail\ContactMessageMail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class ContactController extends Controller
{
    public function store(StoreContactMessageRequest $request): RedirectResponse|\Illuminate\Http\JsonResponse
    {
        $data = $request->validated();

        // Honeypot filled in => silently pretend success, drop the message.
        if (filled($data['website'] ?? null)) {
            return $this->respondSuccess($request);
        }

        try {
            Mail::to('contato@nimvo.com.br')->send(new ContactMessageMail(
                senderName: $data['name'],
                senderEmail: $data['email'],
                senderPhone: $data['phone'] ?: null,
                body: $data['message'],
            ));
        } catch (\Throwable $exception) {
            Log::error('Falha ao enviar mensagem de contato do site', [
                'error' => $exception->getMessage(),
            ]);
        }

        return $this->respondSuccess($request);
    }

    private function respondSuccess(Request $request): RedirectResponse|\Illuminate\Http\JsonResponse
    {
        if ($request->wantsJson()) {
            return response()->json(['ok' => true]);
        }

        return redirect()->to(url()->previous().'#contato')
            ->with('contact_sent', true);
    }
}
