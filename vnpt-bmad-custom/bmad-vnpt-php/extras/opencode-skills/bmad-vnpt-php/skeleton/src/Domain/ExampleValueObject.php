<?php

declare(strict_types=1);

namespace App\Domain;

final readonly class ExampleValueObject
{
    public function __construct(public string $value)
    {
    }
}
