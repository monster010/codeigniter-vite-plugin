/* eslint-disable @typescript-eslint/ban-ts-comment */
import { afterEach, describe, expect, it, vi } from "vitest";
import codeigniter from "../src";

describe("codeigniter-vite-plugin", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("handles missing configuration", () => {
    /* @ts-ignore */
    expect(() => codeigniter()).toThrowError(
      "codeigniter-vite-plugin: missing configuration."
    );

    /* @ts-ignore */
    expect(() => codeigniter({})).toThrowError(
      'codeigniter-vite-plugin: missing configuration for "input".'
    );
  });

  it("accepts a single input", () => {
    const plugin = codeigniter("resources/js/app.ts")[0];

    const config = plugin.config({}, { command: "build", mode: "production" });
    expect(config.build.rollupOptions.input).toBe("resources/js/app.ts");

    const ssrConfig = plugin.config(
      { build: { ssr: true } },
      { command: "build", mode: "production" }
    );
    expect(ssrConfig.build.rollupOptions.input).toBe("resources/js/app.ts");
  });

  it("accepts an array of inputs", () => {
    const plugin = codeigniter([
      "resources/js/app.ts",
      "resources/js/other.js",
    ])[0];

    const config = plugin.config({}, { command: "build", mode: "production" });
    expect(config.build.rollupOptions.input).toEqual([
      "resources/js/app.ts",
      "resources/js/other.js",
    ]);

    const ssrConfig = plugin.config(
      { build: { ssr: true } },
      { command: "build", mode: "production" }
    );
    expect(ssrConfig.build.rollupOptions.input).toEqual([
      "resources/js/app.ts",
      "resources/js/other.js",
    ]);
  });

  it("accepts a full configuration", () => {
    const plugin = codeigniter({
      input: "resources/js/app.ts",
      publicDirectory: "other-public",
      buildDirectory: "other-build",
      ssr: "resources/js/ssr.ts",
      ssrOutputDirectory: "other-ssr-output",
    })[0];

    const config = plugin.config({}, { command: "build", mode: "production" });
    expect(config.base).toBe("/other-build/");
    expect(config.build.manifest).toBe(true);
    expect(config.build.outDir).toBe("other-public/other-build");
    expect(config.build.rollupOptions.input).toBe("resources/js/app.ts");

    const ssrConfig = plugin.config(
      { build: { ssr: true } },
      { command: "build", mode: "production" }
    );
    expect(ssrConfig.base).toBe("/other-build/");
    expect(ssrConfig.build.manifest).toBe(false);
    expect(ssrConfig.build.outDir).toBe("other-ssr-output");
    expect(ssrConfig.build.rollupOptions.input).toBe("resources/js/ssr.ts");
  });

  it("respects users base config option", () => {
    const plugin = codeigniter({
      input: "resources/js/app.ts",
    })[0];

    const userConfig = { base: "/foo/" };

    const config = plugin.config(userConfig, {
      command: "build",
      mode: "production",
    });

    expect(config.base).toBe("/foo/");
  });

  it("accepts a partial configuration", () => {
    const plugin = codeigniter({
      input: "resources/js/app.js",
      ssr: "resources/js/ssr.js",
    })[0];

    const config = plugin.config({}, { command: "build", mode: "production" });
    expect(config.base).toBe("/build/");
    expect(config.build.manifest).toBe(true);
    expect(config.build.outDir).toBe("public/build");
    expect(config.build.rollupOptions.input).toBe("resources/js/app.js");

    const ssrConfig = plugin.config(
      { build: { ssr: true } },
      { command: "build", mode: "production" }
    );
    expect(ssrConfig.base).toBe("/build/");
    expect(ssrConfig.build.manifest).toBe(false);
    expect(ssrConfig.build.outDir).toBe("bootstrap/ssr");
    expect(ssrConfig.build.rollupOptions.input).toBe("resources/js/ssr.js");
  });

  it("uses the default entry point when ssr entry point is not provided", () => {
    // This is support users who may want a dedicated Vite config for SSR.
    const plugin = codeigniter("resources/js/ssr.js")[0];

    const ssrConfig = plugin.config(
      { build: { ssr: true } },
      { command: "build", mode: "production" }
    );
    expect(ssrConfig.build.rollupOptions.input).toBe("resources/js/ssr.js");
  });

  it("prefixes the base with 'app.assetURL' in production mode", () => {
    process.env["app.assetURL"] = "http://example.com";
    const plugin = codeigniter("resources/js/app.js")[0];

    const devConfig = plugin.config(
      {},
      { command: "serve", mode: "development" }
    );
    expect(devConfig.base).toBe("");

    const prodConfig = plugin.config(
      {},
      { command: "build", mode: "production" }
    );
    expect(prodConfig.base).toBe("http://example.com/build/");

    delete process.env["app.assetURL"];
  });

  it("prevents setting an empty publicDirectory", () => {
    expect(
      () =>
        codeigniter({ input: "resources/js/app.js", publicDirectory: "" })[0]
    ).toThrowError("publicDirectory must be a subdirectory");
  });

  it("prevents setting an empty buildDirectory", () => {
    expect(
      () => codeigniter({ input: "resources/js/app.js", buildDirectory: "" })[0]
    ).toThrowError("buildDirectory must be a subdirectory");
  });

  it("handles surrounding slashes on directories", () => {
    const plugin = codeigniter({
      input: "resources/js/app.js",
      publicDirectory: "/public/test/",
      buildDirectory: "/build/test/",
      ssrOutputDirectory: "/ssr-output/test/",
    })[0];

    const config = plugin.config({}, { command: "build", mode: "production" });
    expect(config.base).toBe("/build/test/");
    expect(config.build.outDir).toBe("public/test/build/test");

    const ssrConfig = plugin.config(
      { build: { ssr: true } },
      { command: "build", mode: "production" }
    );
    expect(ssrConfig.build.outDir).toBe("ssr-output/test");
  });

  it("provides an @ alias by default", () => {
    const plugin = codeigniter("resources/js/app.js")[0];

    const config = plugin.config({}, { command: "build", mode: "development" });

    expect(config.resolve.alias["@"]).toBe("/resources/js");
  });

  it("respects a users existing @ alias", () => {
    const plugin = codeigniter("resources/js/app.js")[0];

    const config = plugin.config(
      {
        resolve: {
          alias: {
            "@": "/somewhere/else",
          },
        },
      },
      { command: "build", mode: "development" }
    );

    expect(config.resolve.alias["@"]).toBe("/somewhere/else");
  });

  it("appends an Alias object when using an alias array", () => {
    const plugin = codeigniter("resources/js/app.js")[0];

    const config = plugin.config(
      {
        resolve: {
          alias: [{ find: "@", replacement: "/something/else" }],
        },
      },
      { command: "build", mode: "development" }
    );

    expect(config.resolve.alias).toEqual([
      { find: "@", replacement: "/something/else" },
      { find: "@", replacement: "/resources/js" },
    ]);
  });

  it("does not configure full reload when configuration it not an object", () => {
    const plugins = codeigniter("resources/js/app.js");

    expect(plugins.length).toBe(1);
  });

  it("does not configure full reload when refresh is not present", () => {
    const plugins = codeigniter({
      input: "resources/js/app.js",
    });

    expect(plugins.length).toBe(1);
  });

  it("does not configure full reload when refresh is set to undefined", () => {
    const plugins = codeigniter({
      input: "resources/js/app.js",
      refresh: undefined,
    });
    expect(plugins.length).toBe(1);
  });

  it("does not configure full reload when refresh is false", () => {
    const plugins = codeigniter({
      input: "resources/js/app.js",
      refresh: false,
    });

    expect(plugins.length).toBe(1);
  });

  it("configures full reload with routes and views when refresh is true", () => {
    const plugins = codeigniter({
      input: "resources/js/app.js",
      refresh: true,
    });

    expect(plugins.length).toBe(2);
    /** @ts-ignore */
    expect(plugins[1].__codeigniter_plugin_config).toEqual({
      paths: [
        "app/Views/**",
        "app/Language/**",
        "resources/js/**",
        "resources/css/**",
        "app/Config/Routes.php",
      ],
    });
  });

  it("configures full reload when refresh is a single path", () => {
    const plugins = codeigniter({
      input: "resources/js/app.js",
      refresh: "path/to/watch/**",
    });

    expect(plugins.length).toBe(2);
    /** @ts-ignore */
    expect(plugins[1].__codeigniter_plugin_config).toEqual({
      paths: ["path/to/watch/**"],
    });
  });

  it("configures full reload when refresh is an array of paths", () => {
    const plugins = codeigniter({
      input: "resources/js/app.js",
      refresh: ["path/to/watch/**", "another/to/watch/**"],
    });

    expect(plugins.length).toBe(2);
    /** @ts-ignore */
    expect(plugins[1].__codeigniter_plugin_config).toEqual({
      paths: ["path/to/watch/**", "another/to/watch/**"],
    });
  });

  it("configures full reload when refresh is a complete configuration to proxy", () => {
    const plugins = codeigniter({
      input: "resources/js/app.js",
      refresh: {
        paths: ["path/to/watch/**", "another/to/watch/**"],
        config: { delay: 987 },
      },
    });

    expect(plugins.length).toBe(2);
    /** @ts-ignore */
    expect(plugins[1].__codeigniter_plugin_config).toEqual({
      paths: ["path/to/watch/**", "another/to/watch/**"],
      config: { delay: 987 },
    });
  });

  it("configures full reload when refresh is an array of complete configurations to proxy", () => {
    const plugins = codeigniter({
      input: "resources/js/app.js",
      refresh: [
        {
          paths: ["path/to/watch/**"],
          config: { delay: 987 },
        },
        {
          paths: ["another/to/watch/**"],
          config: { delay: 123 },
        },
      ],
    });

    expect(plugins.length).toBe(3);
    /** @ts-ignore */
    expect(plugins[1].__codeigniter_plugin_config).toEqual({
      paths: ["path/to/watch/**"],
      config: { delay: 987 },
    });
    /** @ts-ignore */
    expect(plugins[2].__codeigniter_plugin_config).toEqual({
      paths: ["another/to/watch/**"],
      config: { delay: 123 },
    });
  });
});
