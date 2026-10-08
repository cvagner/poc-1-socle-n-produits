<?php

use Archi\Core\Http\ApiResponse;
use Illuminate\Support\Facades\Route;

// GET /api/common/hello
Route::get('hello', fn () => ApiResponse::make('common', 'Bonjour depuis le service commun, partagé par tous les clients.'));
