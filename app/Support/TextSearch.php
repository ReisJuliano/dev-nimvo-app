<?php

declare(strict_types=1);

namespace App\Support;

final class TextSearch
{
    public static function normalize(mixed $value): string
    {
        return trim((string) $value);
    }

    public static function hasTerm(mixed $value): bool
    {
        return self::normalize($value) !== '';
    }

    public static function hasWildcard(mixed $value): bool
    {
        return str_contains(self::normalize($value), '%');
    }

    public static function matchesAll(mixed $value): bool
    {
        $term = self::normalize($value);

        return $term !== '' && preg_match('/^%+$/', $term) === 1;
    }

    public static function likePattern(mixed $value): ?string
    {
        $term = self::normalize($value);

        if ($term === '') {
            return null;
        }

        if (! self::hasWildcard($term)) {
            return $term.'%';
        }

        return str_ends_with($term, '%') ? $term : $term.'%';
    }
}
