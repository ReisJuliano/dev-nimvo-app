<?php

namespace Tests;

use Illuminate\Database\Migrations\Migrator;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUpTraits()
    {
        Migrator::withoutMigrations(glob(database_path('migrations/tenant/*.php')) ?: []);

        try {
            return parent::setUpTraits();
        } finally {
            Migrator::withoutMigrations([]);
        }
    }
}
