<?php

namespace Archi\Common;

use Archi\Core\ModuleServiceProvider;

class CommonServiceProvider extends ModuleServiceProvider
{
    protected function module(): string
    {
        return 'common';
    }

    protected function routes(): string
    {
        return __DIR__.'/../routes/api.php';
    }
}
