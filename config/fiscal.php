<?php

return [
    'queues' => [
        'documents' => env('FISCAL_DOCUMENT_QUEUE', 'fiscal'),
    ],

    'agents' => [
        'command_timeout_seconds' => (int) env('FISCAL_AGENT_COMMAND_TIMEOUT', 120),
        'poll_interval_seconds' => (int) env('FISCAL_AGENT_POLL_INTERVAL', 3),
    ],
];
