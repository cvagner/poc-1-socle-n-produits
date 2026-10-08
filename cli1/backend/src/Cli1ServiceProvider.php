<?php

namespace Archi\Cli1;

use Archi\Core\ModuleServiceProvider;

class Cli1ServiceProvider extends ModuleServiceProvider
{
    protected function module(): string
    {
        return 'cli1';
    }

    protected function routes(): string
    {
        return __DIR__.'/../routes/api.php';
    }
}
