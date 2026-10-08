<?php

namespace Archi\Core;

use Illuminate\Support\ServiceProvider;

/**
 * Fournisseur du socle : met à disposition le registre des modules.
 * Le core n'expose aucune route métier.
 */
class CoreServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(ModuleRegistry::class, fn () => new ModuleRegistry(['core']));
    }
}
