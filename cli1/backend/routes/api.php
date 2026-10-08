<?php

use Archi\Core\Http\ApiResponse;
use Illuminate\Support\Facades\Route;

// GET /api/cli1/hello
Route::get('hello', fn () => ApiResponse::make('cli1', 'Bonjour depuis le service spécifique au client 1.'));
