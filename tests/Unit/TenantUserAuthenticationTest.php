<?php

namespace Tests\Unit;

use App\Models\Tenant\User;
use PHPUnit\Framework\TestCase;

class TenantUserAuthenticationTest extends TestCase
{
    public function test_user_auth_identifier_uses_primary_key(): void
    {
        $user = new User();
        $user->id = 7;
        $user->username = 'admin';

        $this->assertSame('id', $user->getAuthIdentifierName());
        $this->assertSame(7, $user->getAuthIdentifier());
    }
}
