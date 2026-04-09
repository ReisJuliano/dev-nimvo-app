<?php

return [
    'queues' => [
        'documents' => env('FISCAL_DOCUMENT_QUEUE', 'fiscal'),
    ],

    'agents' => [
        'command_timeout_seconds' => (int) env('FISCAL_AGENT_COMMAND_TIMEOUT', 120),
        'poll_interval_seconds' => (int) env('FISCAL_AGENT_POLL_INTERVAL', 3),
        'activation_code_expires_minutes' => (int) env('FISCAL_AGENT_ACTIVATION_EXPIRES', 30),
    ],

    'cancellation' => [
        'min_reason_length' => (int) env('FISCAL_CANCELLATION_MIN_REASON', 15),
        'max_hours_after_authorization' => (int) env('FISCAL_CANCELLATION_MAX_HOURS', 24),
        'retry_cooldown_minutes' => (int) env('FISCAL_CANCELLATION_RETRY_COOLDOWN', 5),
    ],
];
