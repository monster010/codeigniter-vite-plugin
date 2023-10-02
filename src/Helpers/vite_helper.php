<?php

use monster010\CodeIgniterVite\Vite;

if (!function_exists('vite_tags')) {
    function vite_tags($entryPoints, $buildDirectory = null): string
    {
        if (!is_array($entryPoints)) {
            $entryPoints = [$entryPoints];
        }

        $vite = new Vite();

        return $vite($entryPoints, $buildDirectory);
    }
}

if (!function_exists('vite')) {
    function vite(): Vite
    {
        $vite = new Vite();

        return $vite;
    }
}

if (!function_exists('vite_react_hmr')) {
    function vite_react_hmr(): string
    {
        $vite = new Vite();

        return $vite->reactRefresh();
    }
}


if (!function_exists('vite_asset')) {
    function vite_asset($asset): string
    {
        $vite = new Vite();

        return $vite->asset($asset);
    }
}
