<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Support\TextSearch;
use PHPUnit\Framework\TestCase;

class TextSearchTest extends TestCase
{
    public function test_it_builds_prefix_search_by_default(): void
    {
        $this->assertSame('amo%', TextSearch::likePattern('amo'));
    }

    public function test_it_preserves_user_wildcards_and_keeps_trailing_matching_open(): void
    {
        $this->assertSame('amo%beb%', TextSearch::likePattern('amo%beb'));
        $this->assertSame('%beb%', TextSearch::likePattern('%beb'));
        $this->assertSame('amo%', TextSearch::likePattern('amo%'));
    }

    public function test_it_recognizes_match_all_searches(): void
    {
        $this->assertTrue(TextSearch::matchesAll('%'));
        $this->assertTrue(TextSearch::matchesAll('%%%'));
        $this->assertFalse(TextSearch::matchesAll('a%'));
    }
}
