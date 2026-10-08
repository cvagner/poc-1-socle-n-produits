<?php

namespace Archi\Core\Http;

use Archi\Core\ModuleRegistry;
use Illuminate\Http\JsonResponse;

/**
 * Format de réponse commun à tous les modules.
 *
 * served_by et modules_loaded rendent visible la topologie de déploiement :
 * API séparées (solution 1) ou API client incluant common (solution 2).
 */
class ApiResponse
{
    public static function make(string $module, string $message): JsonResponse
    {
        return new JsonResponse([
            'module' => $module,
            'message' => $message,
            'served_by' => config('app.name'),
            'modules_loaded' => app(ModuleRegistry::class)->all(),
        ]);
    }
}
