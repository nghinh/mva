<?php

declare(strict_types=1);

namespace App\Application;

final class HealthService
{
    public function check(): array
    {
        return ['status' => 'ok'];
    }
}
