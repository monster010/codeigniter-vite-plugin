<?php

namespace monster010\CodeIgniterVite;

class Vite
{
    protected $nonce;
    protected $integrityKey = 'integrity';
    protected $entryPoints = [];
    protected $preloadedAssets = [];
    protected $hotFile;
    protected $buildDirectory = 'build';
    protected $manifestFilename = 'manifest.json';

    protected static $manifests = [];

    public function withEntryPoints($entryPoints)
    {
        $this->entryPoints = $entryPoints;

        return $this;
    }

    public function useManifestFilename($filename)
    {
        $this->manifestFilename = $filename;

        return $this;
    }

    public function hotFile()
    {
        return $this->hotFile ?? ROOTPATH . 'public/hot';
    }

    public function useHotFile($path)
    {
        $this->hotFile = $path;

        return $this;
    }

    public function useBuildDirectory($path)
    {
        $this->buildDirectory = $path;

        return $this;
    }

    public function isRunningHot()
    {
        return is_file($this->hotFile());
    }

    public function __invoke($entryPoints, $buildDirectory = null)
    {
        if (!is_array($entryPoints)) {
            $entryPoints = [$entryPoints];
        }

        $buildDirectory ??= $this->buildDirectory;

        if ($this->isRunningHot()) {
            array_unshift($entryPoints, '@vite/client');

            return implode(' ', array_map(fn ($entrypoint) => $this->makeTagForChunk($entrypoint, $this->hotAsset($entrypoint), null, null), $entryPoints));
        }

        $manifest = $this->manifest($buildDirectory);
        $tags = [];
        $preloads = [];

        foreach ($entryPoints as $epoint) {
            $chunk = $this->chunk($manifest, $epoint);

            $preloads[] = [
                $chunk['src'],
                $this->assetPath("{$buildDirectory}/{$chunk['file']}"),
                $chunk,
                $manifest
            ];

            foreach ($chunk['imports'] ?? [] as $import) {
                $preloads[] = [
                    $import,
                    $this->assetPath("{$buildDirectory}/{$manifest[$import]['file']}"),
                    $manifest[$import],
                    $manifest
                ];

                foreach ($manifest[$import]['css'] ?? [] as $css) {
                    $partialManifest = $this->array_where($manifest, 'file', $css);

                    $preloads[] = [
                        array_key_first($partialManifest),
                        $this->assetPath("{$buildDirectory}/{$css}"),
                        $partialManifest[array_key_first($partialManifest)],
                        $manifest
                    ];

                    $tags[] = $this->makeTagForChunk(
                        array_key_first($partialManifest),
                        $this->assetPath("{$buildDirectory}/{$css}"),
                        $partialManifest[array_key_first($partialManifest)],
                        $manifest
                    );
                }
            }

            $tags[] = $this->makeTagForChunk(
                $epoint,
                $this->assetPath("{$buildDirectory}/{$chunk['file']}"),
                $chunk,
                $manifest
            );
    
    
            foreach ($chunk['css'] ?? [] as $css) {
                $partialManifest = $this->array_where($manifest, 'file', $css);
    
                $preloads[] = [
                    array_key_first($partialManifest),
                    $this->assetPath("{$buildDirectory}/{$css}"),
		    $this->array_first($partialManifest),
                    $manifest
                ];
    
                $tags[] = $this->makeTagForChunk(
                    array_key_first($partialManifest),
                    $this->assetPath("{$buildDirectory}/{$css}"),
		    $this->array_first($partialManifest),
                    $manifest
                );
            }
        }

        [$stylesheets, $scripts] = $this->array_partition(array_unique($tags), fn ($tag) => str_starts_with($tag, '<link')); // Rework

        $preloads = $this->array_sortByDesc($preloads, fn ($args) => $this->isStylesheetPath($args[1]));
        $preloads = array_map(fn ($args) => $this->makePreloadTagForChunk(...$args), $preloads);

        return implode(' ', $preloads) . implode(' ', $stylesheets) . implode(' ', $scripts);
    }

    protected function makeTagForChunk($src, $url, $chunk, $manifest)
    {
        if ($this->nonce === null && $this->integrityKey !== false && !array_key_exists($this->integrityKey, $chunk ?? [])) {
            return $this->makeTag($url);
        }

        if ($this->isStylesheetPath($url)) {
            return $this->makeStylesheetTagWithAttributes(
                $url,
                $this->resolveStylesheetTagAttributes($src, $url, $chunk, $manifest)
            );
        }

        return $this->makeScriptTagWithAttributes(
            $url,
            $this->resolveScriptTagAttributes($src, $url, $chunk, $manifest)
        );
    }

    protected function makePreloadTagForChunk($src, $url, $chunk, $manifest)
    {
        $attributes = $this->resolvePreloadTagAttributes($src, $url, $chunk, $manifest);

        if ($attributes === false) {
            return '';
        }

        $this->preloadedAssets[$url] = $this->parseAttributes(
            array_map(function ($elem) {
                return $elem === 'href' ?? $elem;
            }, $attributes)
        );

        return '<link ' . implode(' ', $this->parseAttributes($attributes)) . ' />';
    }

    protected function makeTag($url)
    {
        if ($this->isStylesheetPath($url)) {
            return $this->makeStylesheetTag($url);
        }

        return $this->makeScriptTag($url);
    }

    protected function makeScriptTag($url)
    {
        return $this->makeScriptTagWithAttributes($url, []);
    }

    protected function makeStylesheetTag($url)
    {
        return $this->makeStylesheetTagWithAttributes($url, []);
    }

    protected function makeScriptTagWithAttributes($url, $attributes)
    {
        $attributes = $this->parseAttributes(array_merge([
            'type' => 'module',
            'src' => $url,
        ], $attributes));

        return '<script ' . implode(' ', $attributes) . '></script>';
    }

    protected function makeStylesheetTagWithAttributes($url, $attributes)
    {
        $attributes = $this->parseAttributes(array_merge([
            'rel' => 'stylesheet',
            'href' => $url
        ], $attributes));

        return '<link ' . implode(' ', $attributes) . ' />';
    }

    protected function isStylesheetPath($path)
    {
        return preg_match('/\.(css|less|sass|scss|styl|stylus|pcss|postcss)$/', $path) === 1;
    }

    protected function resolveScriptTagAttributes($src, $url, $chunk, $manifest)
    {
        $attributes = $this->integrityKey !== false
            ? ['integrity' => $chunk[$this->integrityKey] ?? false]
            : [];

        return $attributes;
    }

    protected function resolveStylesheetTagAttributes($src, $url, $chunk, $manifest)
    {
        $attributes = $this->integrityKey !== false
            ? ['integrity' => $chunk[$this->integrityKey] ?? false]
            : [];

        return $attributes;
    }

    protected function resolvePreloadTagAttributes($src, $url, $chunk, $manifest)
    {
        $attributes = $this->isStylesheetPath($url) ? [
            'rel' => 'preload',
            'as' => 'style',
            'href' => $url,
            'nonce' => $this->nonce ?? false,
            'crossorigin' => $this->resolveStylesheetTagAttributes($src, $url, $chunk, $manifest)['crossorigin'] ?? false
        ] : [
            'rel' => 'modulepreload',
            'href' => $url,
            'nonce' => $this->nonce ?? false,
            'crossorigin' => $this->resolveScriptTagAttributes($src, $url, $chunk, $manifest)['crossorigin'] ?? false
        ];

        $attributes = $this->integrityKey !== false
            ? array_merge($attributes, ['integrity' => $chunk[$this->integrityKey] ?? false])
            : $attributes;

        return $attributes;
    }

    protected function parseAttributes($attributes)
    {
        $attributes = array_filter($attributes, fn ($v, $k) => !in_array($v, [null, false], true), ARRAY_FILTER_USE_BOTH);
        //$attributes = array_map(fn ($v, $k) => $v === true ? [$k] : [$k => $v], array_values($attributes), array_keys($attributes));
        $attributes = array_map(fn ($v, $k) => is_int($k) ? $v : $k . '="' . $v . '"', array_values($attributes), array_keys($attributes));

        return array_values($attributes);
    }

    public function reactRefresh()
    {
        if (!$this->isRunningHot()) {
            return;
        }

        return sprintf(<<<'HTML'
        <script type="module" %s>
            import RefreshRuntime from '%s'
            RefreshRuntime.injectIntoGlobalHook(window)
            window.$RefreshReg$ = () => {}
            window.$RefreshSig$ = () => (type) => type
            window.__vite_plugin_react_preamble_installed__ = true
        </script>
        HTML, [], $this->hotAsset('@react-refresh'));
    }

    protected function hotAsset($asset)
    {
        return rtrim(file_get_contents($this->hotFile())) . '/' . $asset;
    }

    public function asset($asset, $buildDirectory = null)
    {
        $buildDirectory ??= $this->buildDirectory;

        if ($this->isRunningHot()) {
            return $this->hotAsset($asset);
        }

        $chunk = $this->chunk($this->manifest($buildDirectory), $asset);

        return $this->assetPath($buildDirectory . '/' . $chunk['file']);
    }

    protected function assetPath($path)
    {
        return base_url($path);
    }

    protected function manifest($buildDirectory)
    {
        $path = $this->manifestPath($buildDirectory);

        if (!isset(static::$manifests[$path])) {
            if (!is_file($path)) {
                throw new \Exception("Vite manifest not found at: $path");
            }

            static::$manifests[$path] = json_decode(file_get_contents($path), true);
        }

        return static::$manifests[$path];
    }

    protected function manifestPath($buildDirectory)
    {
        return ROOTPATH . 'public/' . $buildDirectory . '/' . $this->manifestFilename;
    }

    public function manifestHash($buildDirectory = null)
    {
        $buildDirectory ??= $this->buildDirectory;

        if ($this->isRunningHot()) {
            return null;
        }

        if (!is_file($path = $this->manifestPath($buildDirectory))) {
            return null;
        }

        return md5_file($path) ?: null;
    }

    protected function chunk($manifest, $file)
    {
        if (!isset($manifest[$file])) {
            throw new \Exception("Unable to locate file in Vite manifest: {$file}.");
        }

        return $manifest[$file];
    }

    private function array_where($arr, $key, $value)
    {
        return array_filter($arr, function ($ar) use ($key, $value) {
            return ($ar[$key] == $value);
        });
    }

    private function array_partition(array $array, callable $callback) {
		$passed = [];
		$failed = [];
		
		foreach($array as $key => $item) {
			if($callback($item, $key)) {
				$passed[$key] = $item;
			} else {
				$failed[$key] = $item;
			}
		}
		
		return [$passed, $failed];
	}

	private function array_first($arr, $default = null) {
		$obj = new \ArrayObject($arr);
		
		$it = $obj->getIterator();
		
		if(!$it->valid()) {
			return $this->array_value($default);
		}
		
		return $it->current();
	}
	
	private function array_value($value, ...$args) {
		return $value instanceof \Closure ? $value(...$args) : $value;
	}
	
	private function array_sortBy($array, $callback, $options = SORT_REGULAR, $descending = false) {
		$results = [];
		$callback = $this->valueRetriever($callback);
		
		foreach($array as $key => $value) {
			$results[$key] = $callback($value, $key);
		}
		
		$descending ? arsort($results, $options) : asort($results, $options);
		
		foreach(array_keys($results) as $key) {
			$results[$key] = $array[$key];
		}
		
		return $results;
	}
	
	private function array_sortByDesc($array, $callback, $options = SORT_REGULAR) {
		return $this->array_sortBy($array, $callback, $options, true);
	}
	
	private function useAsCallable($value) {
		return !is_string($value) && is_callable($value);
	}
	
	private function valueRetriever($value) {
		if($this->useAsCallable($value)) {
			return $value;
		}
		
		return null;
	}
}
