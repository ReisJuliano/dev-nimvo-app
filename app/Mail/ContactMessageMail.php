<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class ContactMessageMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly string $senderName,
        public readonly string $senderEmail,
        public readonly ?string $senderPhone,
        public readonly string $body,
    ) {}

    public function build(): self
    {
        return $this
            ->subject("Novo contato pelo site — {$this->senderName}")
            ->replyTo($this->senderEmail, $this->senderName)
            ->view('emails.contact-message');
    }
}
