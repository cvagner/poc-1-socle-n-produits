<?php

use Archi\Core\Http\ApiResponse;
use Illuminate\Support\Facades\Route;

// GET /api/cli2/hello
Route::get('hello', fn () => ApiResponse::make('cli2', 'Bonjour depuis le service spécifique au client 2.'));
