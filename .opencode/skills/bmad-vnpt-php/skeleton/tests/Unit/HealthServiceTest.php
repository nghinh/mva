<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Application\HealthService;
use PHPUnit\Framework\TestCase;

final class HealthServiceTest extends TestCase
{
    public function testCheckReturnsOkStatus(): void
    {
        $service = new HealthService();

        self::assertSame(['status' => 'ok'], $service->check());
    }
}
