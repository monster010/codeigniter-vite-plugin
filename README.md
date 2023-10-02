# CodeIgniter Vite Plugin

<a href="https://github.com/monster010/codeigniter-vite-plugin/actions"><img src="https://github.com/monster010/codeigniter-vite-plugin/workflows/tests/badge.svg" alt="Build Status"></a>
<a href="https://www.npmjs.com/package/codeigniter-vite-plugin"><img src="https://img.shields.io/npm/dt/codeigniter-vite-plugin" alt="Total Downloads"></a>
<a href="https://www.npmjs.com/package/codeigniter-vite-plugin"><img src="https://img.shields.io/npm/v/codeigniter-vite-plugin" alt="Latest Stable Version"></a>
<a href="https://github.com/monster010/codeigniter-vite-plugin/blob/main/LICENSE.md"><img src="https://img.shields.io/npm/l/codeigniter-vite-plugin" alt="License"></a>

## Introduction

[Vite](https://vitejs.dev) is a modern frontend build tool that provides an extremely fast development environment and bundles your code for production.

This plugin configures Vite for use with a CodeIgniter backend server.

This plugin is based on the [Laravel Vite plugin](https://github.com/laravel/vite-plugin).

## Installation

Install with composer:

```shell
composer require monster010/codeigniter-vite-plugin
```

Publish default resources (package.json, vite.config.js, tailwind.config.js, etc.)

```shell
php spark vite:publish
```

Alternative:

```
// vite.config.js
import { defineConfig } from 'vite';
import codeigniter from "codeigniter-vite-plugin";

export default defineConfig({
    plugins: [
        codeigniter([
            'resources/css/app.css',
            'resources/js/app.js',
        ]),
    ],
});
```

## Getting Started

- Install your node dependencies: `npm install`
- Start vite server: `npm run dev`
- Loading helper `helper('vite')`

### Loading Your Scripts and Styles

```
<!doctype html>
<head>
    {{-- ... --}}

    <?= vite_tags(['resources/css/app.css', 'resources/js/app.js']) ?>
</head>
```

Alternative:

```
<!doctype html>
<head>
    {{-- ... --}}

    <?= vite_tags('resources/js/app.js') ?>
</head>
```

## License

The CodeIgniter Vite plugin is open-sourced software licensed under the [MIT license](LICENSE.md).
