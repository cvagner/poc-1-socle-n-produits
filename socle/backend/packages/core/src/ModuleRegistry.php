<?php

namespace Archi\Core;

/**
 * Liste des modules chargés dans l'API courante.
 */
class ModuleRegistry
{
    /** @param list<string> $modules */
    public function __construct(private array $modules = [])
    {
    }

    public function register(string $module): void
    {
        if (! in_array($module, $this->modules, true)) {
            $this->modules[] = $module;
        }
    }

    /** @return list<string> */
    public function all(): array
    {
        return $this->modules;
    }
}
