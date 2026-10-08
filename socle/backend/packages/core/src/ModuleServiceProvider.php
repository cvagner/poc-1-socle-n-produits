<?php

namespace Archi\Core;

use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

/**
 * Base des fournisseurs de module (common, cliN) : déclare le module auprès
 * du registre et monte ses routes sous /api/<module>.
 */
abstract class ModuleServiceProvider extends ServiceProvider
{
    /** Nom du module, utilisé aussi comme préfixe d'URL. */
    abstract protected function module(): string;

    /** Chemin du fichier de routes du module. */
    abstract protected function routes(): string;

    public function boot(ModuleRegistry $registry): void
    {
        $registry->register($this->module());

        Route::prefix('api/'.$this->module())
            ->middleware('api')
            ->group($this->routes());
    }
}
