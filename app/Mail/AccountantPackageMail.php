<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;

class AccountantPackageMail extends Mailable
{

    public function __construct(
        public readonly string $storeName,
        public readonly int $year,
        public readonly int $month,
        public readonly string $zipAbsolutePath,
    ) {}

    public function build(): self
    {
        $monthLabel = sprintf('%02d/%04d', $this->month, $this->year);

        return $this
            ->subject("Pacote fiscal {$monthLabel} — {$this->storeName}")
            ->view('emails.accountant-package', [
                'storeName' => $this->storeName,
                'monthLabel' => $monthLabel,
            ])
            ->attach($this->zipAbsolutePath, [
                'as' => sprintf('contador-%04d-%02d.zip', $this->year, $this->month),
                'mime' => 'application/zip',
            ]);
    }
}
