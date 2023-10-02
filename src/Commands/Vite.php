<?php

namespace monster010\CodeIgniterVite\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;
use CodeIgniter\Publisher\Publisher;
use Throwable;

class Vite extends BaseCommand
{
    protected $group = 'Vite';
    protected $name = 'vite:publish';
    protected $description = 'Publish CodeIgniter Vite plugin files.';

    protected $stop, $sourcePath;

    public function __construct()
    {
        $this->sourcePath = service('autoloader')->getNamespace('monster010\CodeIgniterVite')[0];
    }

    public function run(array $params): void
    {
        CLI::write('Initializing Codeigniter Vite Plugin', 'white', 'cyan');
        CLI::newLine();

        $this->stop = false;

        $this->publishConfigs();
        $this->generateResourceFiles();

        CLI::write('CodeIgniter vite initialized successfully ✅', 'green');
        CLI::newLine();

        CLI::write('run: npm install && npm run dev');
        CLI::newLine();
    }

    private function publishConfigs()
    {
        $publisher = new Publisher("{$this->sourcePath}/stubs", ROOTPATH);

        try {
            $publisher->addPath('.')->merge();
        } catch (Throwable $e) {
            $this->showError($e);
            return;
        }
    }

    private function generateResourceFiles()
    {
        helper('filesystem');

        CLI::write('⚡ Generating resource files...', 'yellow');
        CLI::newLine();

        # Resource files.
        $resourceFiles = directory_map("{$this->sourcePath}/stubs/resources", 1, true);

        $publisher = new Publisher("{$this->sourcePath}/stubs/resources", ROOTPATH);

        # Publish them.
        try {
            $publisher->addPaths($resourceFiles)->merge(true);
        } catch (Throwable $e) {
            $this->showError($e);
            return;
        }

        CLI::write('Resource files are ready ✅', 'green');
        CLI::newLine();
    }
}
