<?php

namespace Archi\Cli2;

use Archi\Core\ModuleServiceProvider;

class Cli2ServiceProvider extends ModuleServiceProvider
{
    protected function module(): string
    {
        return 'cli2';
    }

    protected function routes(): string
    {
        return __DIR__.'/../routes/api.php';
    }
}
