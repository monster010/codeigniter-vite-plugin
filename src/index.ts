import { AddressInfo } from "net";
import {
  ConfigEnv,
  UserConfig,
  Plugin,
  loadEnv,
  PluginOption,
  ResolvedConfig,
} from "vite";
import fullReload, {
  Config as FullReloadConfig,
} from "vite-plugin-full-reload";
import colors from "picocolors";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

interface PluginConfig {
  /**
   * The path or paths of the entry points to compile.
   */
  input: string | string[];

  /**
   * Public directory of CodeIgniter
   *
   * @default 'public'
   */
  publicDirectory?: string;

  /**
   * The public subdirectory where compiled assets should be written.
   *
   * @default 'build'
   */
  buildDirectory?: string;

  /**
   * The path to the "hot" file.
   *
   * @default `${publicDirectory}/hot`
   */
  hotFile?: string;

  /**
   * The path of the SSR entry point.
   */
  ssr?: string | string[];

  /**
   * The directory where the SSR bundle should be written.
   *
   * @default 'bootstrap/ssr'
   */
  ssrOutputDirectory?: string;

  /**
   * Configuration for performing full page refresh on blade (or other) file changes.
   *
   * {@link https://github.com/ElMassimo/vite-plugin-full-reload}
   * @default false
   */
  refresh?: boolean | string | string[] | RefreshConfig | RefreshConfig[];

  /**
   * Utilise the Herd or Valet TLS certificates.
   *
   * @default false
   */
  detectTls?: string | boolean;

  /**
   * Transform the code while serving
   */
  transformOnServe?: (code: string, url: DevServerUrl) => string;
}

interface RefreshConfig {
  paths: string[];
  config?: FullReloadConfig;
}

interface CodeIgniterPlugin extends Plugin {
  config: (config: UserConfig, env: ConfigEnv) => UserConfig;
}

type DevServerUrl = `${"http" | "https"}://${string}:${number}`;

let exitHandlersBound = false;

export const refreshPaths = [
  "app/Views/**",
  "app/Language/**",
  "resources/js/**",
  "resources/css/**",
  "app/Config/Routes.php",
];

export default function codeIgniter(
  config: string | string[] | PluginConfig
): [CodeIgniterPlugin, ...Plugin[]] {
  const pluginConfig = resolvePluginConfig(config);

  return [
    resolveCodeIgniterPlugin(pluginConfig),
    ...(resolveFullReloadConfig(pluginConfig) as Plugin[]),
  ];
}

function resolveCodeIgniterPlugin(
  pluginConfig: Required<PluginConfig>
): CodeIgniterPlugin {
  let viteDevServerUrl: DevServerUrl;
  let resolvedConfig: ResolvedConfig;
  let userConfig: UserConfig;

  const defaultAliases: Record<string, string> = {
    "@": "/resources/js",
  };

  return {
    name: "codeigniter",
    enforce: "post",
    config: (config: UserConfig, { command, mode }) => {
      userConfig = config;

      const ssr = !!userConfig.build?.ssr;
      const env = loadEnv(mode, userConfig.envDir || process.cwd(), "");
      const assetUrl = env["app.baseURL"] ?? "";
      const serverConfig =
        command === "serve"
          ? resolveDevelopmentEnvironmentServerConfig(pluginConfig.detectTls) ??
            resolveEnvironmentServerConfig(env)
          : undefined;

      ensureCommandShouldRunInEnvironment(command, env);

      return {
        base:
          userConfig.base ??
          (command === "build" ? resolveBase(pluginConfig, assetUrl) : ""),
        publicDir: userConfig.publicDir ?? false,
        build: {
          manifest: userConfig.build?.manifest ?? !ssr,
          outDir: userConfig.build?.outDir ?? resolveOutDir(pluginConfig, ssr),
          rollupOptions: {
            input:
              userConfig.build?.rollupOptions?.input ??
              resolveInput(pluginConfig, ssr),
          },
          assetsInlineLimit: userConfig.build?.assetsInlineLimit ?? 0,
        },
        server: {
          origin:
            userConfig.server?.origin ?? "__codeigniter_vite_placeholder__",
          ...(serverConfig
            ? {
                host: userConfig.server?.host ?? serverConfig.host,
                hmr:
                  userConfig.server?.hmr === false
                    ? false
                    : {
                        ...serverConfig.hmr,
                        ...(userConfig.server?.hmr === true
                          ? {}
                          : userConfig.server?.hmr),
                      },
                https:
                  userConfig.server?.https === false
                    ? false
                    : {
                        ...serverConfig.https,
                        ...(userConfig.server?.https === true
                          ? {}
                          : userConfig.server?.https),
                      },
              }
            : undefined),
        },
        resolve: {
          alias: Array.isArray(userConfig.resolve?.alias)
            ? [
                ...(userConfig.resolve?.alias ?? []),
                ...Object.keys(defaultAliases).map((alias) => ({
                  find: alias,
                  replacement: defaultAliases[alias],
                })),
              ]
            : {
                ...defaultAliases,
                ...userConfig.resolve?.alias,
              },
        },
      };
    },
    configResolved(config) {
      resolvedConfig = config;
    },
    transform(code) {
      if (resolvedConfig.command === "serve") {
        code = code.replace(
          /__codeigniter_vite_placeholder__/g,
          viteDevServerUrl
        );

        return pluginConfig.transformOnServe(code, viteDevServerUrl);
      }
    },
    configureServer(server) {
      const envDir = resolvedConfig.envDir || process.cwd();
      const appUrl =
        loadEnv(resolvedConfig.mode, envDir, "app.baseURL")["app.baseURL"] ??
        "undefined";

      server.httpServer?.once("listening", () => {
        const address = server.httpServer?.address();
        const isAddressInfo = (
          x: string | AddressInfo | null | undefined
        ): x is AddressInfo => typeof x === "object";

        if (isAddressInfo(address)) {
          viteDevServerUrl = resolveDevServerUrl(address, server.config);
          fs.writeFileSync(pluginConfig.hotFile, viteDevServerUrl);

          setTimeout(() => {
            server.config.logger.info(
              `\n  ${colors.yellow(
                `${colors.bold("CodeIgniter")} ${codeIgniterVersion()}`
              )}  ${colors.dim("plugin")} ${colors.bold(`v${pluginVersion()}`)}`
            );
            server.config.logger.info("");
            server.config.logger.info(
              `  ${colors.green("➜")}  ${colors.bold(
                "app.baseUrl"
              )}: ${colors.cyan(
                appUrl.replace(/:(\d+)/, (_, port) => `:${colors.bold(port)}`)
              )}`
            );
          }, 100);
        }
      });

      if (!exitHandlersBound) {
        const clean = () => {
          if (fs.existsSync(pluginConfig.hotFile)) {
            fs.rmSync(pluginConfig.hotFile);
          }
        };

        process.on("exit", clean);
        process.on("SIGINT", process.exit);
        process.on("SIGTERM", process.exit);
        process.on("SIGHUP", process.exit);

        exitHandlersBound = true;
      }

      return () =>
        server.middlewares.use((req, res, next) => {
          if (req.url === "/index.html") {
            req.statusCode = 404;

            res.end(
              fs
                .readFileSync(path.join(dirname(), "dev-server-index.html"))
                .toString()
                .replace(/{{ APP_BASEURL }}/g, appUrl)
            );
          }

          next();
        });
    },
  };
}

function ensureCommandShouldRunInEnvironment(
  command: "build" | "serve",
  env: Record<string, string>
): void {
  if (command === "build" || env.CODEIGNITER_BYPASS_ENV_CHECK === "1") {
    return;
  }

  if (typeof env.CI !== "undefined") {
    throw Error(
      "You should not run the Vite HMR server in CI/CD environments. You should build your assets for production instead. To disable this ENV check you may set CODEIGNITER_BYPASS_ENV_CHECK=1"
    );
  }
}

function codeIgniterVersion(): string {
  try {
    const composer = JSON.parse(fs.readFileSync("composer.lock").toString());

    return (
      composer.packages?.find(
        (composerPackage: { name: string }) =>
          composerPackage.name === "codeigniter4/framework"
      )?.version ?? ""
    );
  } catch {
    return "";
  }
}

function pluginVersion(): string {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(dirname(), "../package.json")).toString()
    )?.version;
  } catch {
    return "";
  }
}

function resolvePluginConfig(
  config: string | PluginConfig | string[]
): Required<PluginConfig> {
  if (typeof config === "undefined") {
    throw new Error("codeigniter-vite-plugin: missing configuration");
  }

  if (typeof config === "string" || Array.isArray(config)) {
    config = { input: config, ssr: config };
  }

  if (typeof config.input === "undefined") {
    throw new Error(
      'codeigniter-vite-plugin: missing configuration for "input".'
    );
  }

  if (typeof config.publicDirectory === "string") {
    config.publicDirectory = config.publicDirectory.trim().replace(/^\/+/, "");

    if (config.publicDirectory === "") {
      throw new Error(
        'codeigniter-vite-plugin: publicDirectory must be a subdirectory. E.g. "public".'
      );
    }
  }

  if (typeof config.buildDirectory === "string") {
    config.buildDirectory = config.buildDirectory
      .trim()
      .replace(/^\/+/, "")
      .replace(/\/+$/, "");

    if (config.buildDirectory === "") {
      throw new Error(
        'codeigniter-vite-plugin: buildDirectory must be a subdirectory. E.g. "build".'
      );
    }
  }

  if (typeof config.ssrOutputDirectory === "string") {
    config.ssrOutputDirectory = config.ssrOutputDirectory
      .trim()
      .replace(/^\/+/, "")
      .replace(/\/+$/, "");
  }

  if (config.refresh === true) {
    config.refresh = [{ paths: refreshPaths }];
  }

  return {
    input: config.input,
    publicDirectory: config.publicDirectory ?? "public",
    buildDirectory: config.buildDirectory ?? "build",
    ssr: config.ssr ?? config.input,
    ssrOutputDirectory: config.ssrOutputDirectory ?? "bootstrap/ssr",
    refresh: config.refresh ?? false,
    hotFile:
      config.hotFile ?? path.join(config.publicDirectory ?? "public", "hot"),
    detectTls: config.detectTls ?? false,
    transformOnServe: config.transformOnServe ?? ((code) => code),
  };
}

function resolveBase(config: Required<PluginConfig>, assetUrl: string): string {
  return (
    assetUrl +
    (!assetUrl.endsWith("/") ? "/" : "") +
    config.buildDirectory +
    "/"
  );
}

function resolveInput(
  config: Required<PluginConfig>,
  ssr: boolean
): string | string[] | undefined {
  if (ssr) {
    return config.ssr;
  }

  return config.input;
}

function resolveOutDir(
  config: Required<PluginConfig>,
  ssr: boolean
): string | undefined {
  if (ssr) {
    return config.ssrOutputDirectory;
  }

  return path.join(config.publicDirectory, config.buildDirectory);
}

function resolveFullReloadConfig({
  refresh: config,
}: Required<PluginConfig>): PluginOption[] {
  if (typeof config === "boolean") {
    return [];
  }

  if (typeof config === "string") {
    config = [{ paths: [config] }];
  }

  if (!Array.isArray(config)) {
    config = [config];
  }

  if (config.some((c) => typeof c === "string")) {
    config = [{ paths: config }] as RefreshConfig[];
  }

  return (config as RefreshConfig[]).flatMap((c) => {
    const plugin = fullReload(c.paths, c.config);

    /* eslint-disable-next-line @typescript-eslint/ban-ts-comment */
    /** @ts-ignore */
    plugin.__codeigniter_plugin_config = c;

    return plugin;
  });
}

function resolveDevServerUrl(
  address: AddressInfo,
  config: ResolvedConfig
): DevServerUrl {
  const configHmrProtocol =
    typeof config.server.hmr === "object" ? config.server.hmr.protocol : null;
  const clientProtocol = configHmrProtocol
    ? configHmrProtocol === "wss"
      ? "https"
      : "http"
    : null;
  const serverProtocol = config.server.https ? "https" : "http";
  const protocol = clientProtocol ?? serverProtocol;

  const configHmrHost =
    typeof config.server.hmr === "object" ? config.server.hmr.host : null;
  const configHost =
    typeof config.server.host === "string" ? config.server.host : null;
  const serverAddress = isIPv6(address)
    ? `[${address.address}]`
    : address.address;
  const host = configHmrHost ?? configHost ?? serverAddress;

  const configHmrClientPort =
    typeof config.server.hmr === "object" ? config.server.hmr.clientPort : null;
  const port = configHmrClientPort ?? address.port;

  return `${protocol}://${host}:${port}`;
}

function isIPv6(address: AddressInfo): boolean {
  return (
    address.family === "IPv6" ||
    // In node >=18.0 <18.4 this was an integer value. This was changed in a minor version.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore-next-line
    address.family === 6
  );
}

function resolveEnvironmentServerConfig(env: Record<string, string>):
  | {
      hmr?: { host: string };
      host?: string;
      https?: { cert: Buffer; key: Buffer };
    }
  | undefined {
  if (!env.VITE_DEV_SERVER_KEY && !env.VITE_DEV_SERVER_CERT) {
    return;
  }

  if (
    !fs.existsSync(env.VITE_DEV_SERVER_KEY) ||
    !fs.existsSync(env.VITE_DEV_SERVER_CERT)
  ) {
    throw Error(
      `Unable to find the certificate files specified in your environment. Ensure you have correctly configured VITE_DEV_SERVER_KEY: [${env.VITE_DEV_SERVER_KEY}] and VITE_DEV_SERVER_CERT: [${env.VITE_DEV_SERVER_CERT}].`
    );
  }

  const host = resolveHostFromEnv(env);

  if (!host) {
    throw Error(
      `Unable to determine the host from the environment's app.baseURL: [${env["app.baseURL"]}].`
    );
  }

  return {
    hmr: { host },
    host,
    https: {
      key: fs.readFileSync(env.VITE_DEV_SERVER_KEY),
      cert: fs.readFileSync(env.VITE_DEV_SERVER_CERT),
    },
  };
}

function resolveHostFromEnv(env: Record<string, string>): string | undefined {
  try {
    return new URL(env.APP_URL).host;
  } catch {
    return;
  }
}

function resolveDevelopmentEnvironmentServerConfig(host: string | boolean):
  | {
      hmr?: { host: string };
      host?: string;
      https?: { cert: Buffer; key: Buffer };
    }
  | undefined {
  if (host === false) {
    return;
  }

  const configPath = determineDevelopmentEnvironmentConfigPath();

  host = host === true ? resolveDevelopmentEnvironmentHost(configPath) : host;

  const keyPath = path.resolve(configPath, "Certificates", `${host}.key`);
  const certPath = path.resolve(configPath, "Certificates", `${host}.crt`);

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    throw Error(
      `Unable to find certificate files for your host [${host}] in the [${configPath}/Certificates] directory. Ensure you have secured the site via the Herd UI or run \`valet secure\`.`
    );
  }

  return {
    hmr: { host },
    host,
    https: {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    },
  };
}

function determineDevelopmentEnvironmentConfigPath(): string {
  const herdConfigPath = path.resolve(
    os.homedir(),
    "Library",
    "Application Support",
    "Herd",
    "config",
    "valet"
  );

  if (fs.existsSync(herdConfigPath)) {
    return herdConfigPath;
  }

  return path.resolve(os.homedir(), ".config", "valet");
}

function resolveDevelopmentEnvironmentHost(configPath: string): string {
  const configFile = path.resolve(configPath, "config.json");

  if (!fs.existsSync(configFile)) {
    throw Error(
      `Unable to find the configuration file [${configFile}]. You will need to manually specify the host in the \`detectTls\` configuration option.`
    );
  }

  const config: { tld: string } = JSON.parse(
    fs.readFileSync(configFile, "utf-8")
  );

  return path.basename(process.cwd()) + "." + config.tld;
}

function dirname(): string {
  return fileURLToPath(new URL(".", import.meta.url));
}
